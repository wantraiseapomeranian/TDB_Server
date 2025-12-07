import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/users.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { UserGroup } from '../users/entities/user-group.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { v4 as uuidv4 } from 'uuid';

interface SignupParams {
  id: string;
  password: string;
  name: string;
  birthDate: string;
  age: number;
  accountType: 'parent' | 'child';
  role?: 'parent' | 'child';
  parentGroupId?: string; // 기존 group_id 직접 전달
  parentUuid?: string; // 🔥 부모의 user_id를 받아서 group_id 찾기
  groupName?: string; // 🔥 사용자가 입력한 그룹명
}

export interface TokenPayload {
  sub: string;
  role: UserRole;
  groupId?: string;
  type?: 'access' | 'refresh' | 'device';
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserGroup)
    private readonly userGroupRepository: Repository<UserGroup>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async signup(params: SignupParams) {

    const {
      id,
      password,
      parentGroupId,
      parentUuid,
      groupName,
      name,
      birthDate,
      age,
      role,
      accountType,
    } = params;


    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { user_id: id },
      });


      if (existingUser) {
        throw new ConflictException('이미 등록된 사용자입니다.');
      }


      const hashedPassword = await bcrypt.hash(
        password,
        parseInt(process.env.HASH_ROUNDS || '10'),
      );


      const userRole: UserRole = (role || accountType) as UserRole;

      if (!Object.values(UserRole).includes(userRole)) {
        throw new ConflictException(
          'role은 "parent" 또는 "child"만 허용됩니다.',
        );
      }

      // 사용자 엔터티 생성
      const user = queryRunner.manager.create(User, {
        user_id: id,
        password: hashedPassword,
        name,
        birthDate: new Date(birthDate),
        age,
        took_today: 0,
      });


      const savedUser = await queryRunner.manager.save(User, user);

      if (!savedUser || !savedUser.user_id) {
        throw new ConflictException(
          '회원가입 저장에 실패했습니다. 필수 정보가 누락됐을 수 있습니다.',
        );
      }

      let groupId: string;
      let group: UserGroup;

      const normalizedParentUuid = parentUuid?.trim();
      const normalizedParentGroupId = parentGroupId?.trim();

      if (userRole === UserRole.PARENT) {
        // 부모 사용자인 경우 새 그룹 생성
        groupId = uuidv4();
        const finalGroupName = groupName || `${name}님의 가족`; // 🔥 사용자 입력 그룹명 우선 사용
        group = queryRunner.manager.create(UserGroup, {
          group_id: groupId,
          group_name: finalGroupName,
          parent_user_id: savedUser.user_id,
          note: 'Auto-created family group',
        });
        
        await queryRunner.manager.save(UserGroup, group);
      } else {
        // 자녀 사용자인 경우 기존 그룹에 참여
        let targetGroupId = normalizedParentGroupId;

        // 🔥 parentUuid가 제공된 경우, 부모의 group_id를 찾기
        if (!targetGroupId && normalizedParentUuid) {
          
          // 부모의 멤버십 정보를 통해 group_id 찾기
          const parentMembership = await queryRunner.manager.findOne(UserGroupMembership, {
            where: { user_id: normalizedParentUuid },
          });

          if (!parentMembership) {
            throw new ConflictException('지정된 보호자 계정을 찾을 수 없습니다.');
          }

          targetGroupId = parentMembership.group_id;
        }

        if (!targetGroupId) {
          throw new ConflictException('서브 계정은 보호자 그룹 ID 또는 보호자 계정 ID가 필요합니다.');
        }

        group = await queryRunner.manager.findOne(UserGroup, {
          where: { group_id: targetGroupId },
        });

        if (!group) {
          throw new ConflictException(
            '해당 그룹을 찾을 수 없습니다.',
          );
        }

        groupId = targetGroupId;
      }

      // 멤버십 생성
      const membership = queryRunner.manager.create(UserGroupMembership, {
        group_id: groupId,
        user_id: savedUser.user_id,
        role: userRole,
      });

      await queryRunner.manager.save(UserGroupMembership, membership);


      // 회원가입 성공 시 토큰 생성
      const accessToken = this.signToken(savedUser, userRole, groupId, 'access');
      const refreshToken = this.signToken(savedUser, userRole, groupId, 'refresh');

      // refresh token을 데이터베이스에 저장
      await queryRunner.manager.update(User, savedUser.user_id, {
        refresh_token: refreshToken,
      });

      await queryRunner.commitTransaction();


      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          user_id: savedUser.user_id,  // 🔥 id → user_id로 통일
          name: savedUser.name,
          role: userRole,
          groupId: groupId,
          groupName: group.group_name, // 🔥 그룹명 추가
          birthDate: savedUser.birthDate,
          age: savedUser.age,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async login(id: string, password: string) {

    const user = await this.userRepository.findOne({ where: { user_id: id } });

    if (!user) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('비밀번호가 올바르지 않습니다.');
    }

    // 사용자의 멤버십 정보 조회
    const membership = await this.membershipRepository.findOne({
      where: { user_id: id },
      relations: ['group'],
    });

    if (!membership) {
      throw new UnauthorizedException('사용자의 그룹 정보를 찾을 수 없습니다.');
    }

    const accessToken = this.signToken(user, membership.role, membership.group_id, 'access');
    const refreshToken = this.signToken(user, membership.role, membership.group_id, 'refresh');

    await this.userRepository.update(user.user_id, {
      refresh_token: refreshToken,
    });


    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user_id: user.user_id,  // 🔥 id → user_id로 통일
        name: user.name,
        role: membership.role,
        groupId: membership.group_id,
        groupName: membership.group?.group_name || `${user.name}님의 가족`,
        k_uid: user.k_uid,
        birthDate: user.birthDate,
        age: user.age,
        took_today: user.took_today,
      },
    };
  }

  private signToken(
    user: Pick<User, 'user_id'>,
    role: UserRole,
    groupId: string,
    type: 'access' | 'refresh',
  ): string {
    const payload = {
      sub: user.user_id,
      role: role,
      groupId: groupId,
      type,
    };
    const expiresIn = type === 'access' ? '10h' : '7d';
    return this.jwtService.sign(payload, { expiresIn });
  }

  async updateRefreshToken(userId: string, token: string): Promise<void> {
    await this.userRepository.update(userId, { refresh_token: token });
  }

  async logout(id: string) {

    try {
      const user = await this.userRepository.findOne({
        where: { user_id: id },
      });

      if (!user) {
        throw new UnauthorizedException('존재하지 않는 사용자입니다.');
      }

      await this.userRepository.update(user.user_id, {
        refresh_token: '',
      });


      return {
        success: true,
        message: '로그아웃이 완료되었습니다.',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async checkAuth(user: TokenPayload) {

    const foundUser = await this.userRepository.findOne({
      where: { user_id: user.sub },
    });

    if (!foundUser) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    // 멤버십 정보도 함께 조회
    const membership = await this.membershipRepository.findOne({
      where: { user_id: user.sub },
    });

    return {
      success: true,
      data: {
        isAuthenticated: true,
        user: {
          id: foundUser.user_id,
          name: foundUser.name,
          role: membership?.role || user.role,
          groupId: membership?.group_id || user.groupId,
          k_uid: foundUser.k_uid,
          took_today: foundUser.took_today,
        },
      },
    };
  }

  extractTokenFromHeader(header: string, isBearer = true): string {
    const type = isBearer ? 'Bearer' : 'Basic';
    if (!header.startsWith(type)) {
      throw new UnauthorizedException(`${type} 형식의 인증 토큰이 아닙니다.`);
    }
    return header.slice(type.length).trim();
  }

  decodeBasicToken(token: string): { id: string; password: string } {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [id, password] = decoded.split(':');
      if (!id || !password) throw new Error();
      return { id, password };
    } catch {
      throw new UnauthorizedException('Basic 토큰 디코딩에 실패했습니다.');
    }
  }

  async authenticateWithIdAndPassword({
    id,
    password,
  }: {
    id: string;
    password: string;
  }) {
    const user = await this.userRepository.findOne({
      where: { user_id: id },
    });

    if (!user) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('비밀번호가 일치하지 않습니다.');
    }

    // 멤버십 정보 조회
    const membership = await this.membershipRepository.findOne({
      where: { user_id: id },
    });

    return {
      user_id: user.user_id,
      name: user.name,
      role: membership?.role,
      uid: user.k_uid,
    };
  }

  verifyToken(token: string): TokenPayload {
    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException(
          'Refresh Token이 만료되었습니다. 다시 로그인해주세요.',
        );
      } else if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }
      throw new UnauthorizedException('토큰 인증 중 오류가 발생했습니다.');
    }
  }

  generateTokens(user: Pick<User, 'user_id'>, role: UserRole, groupId: string) {
    const accessToken = this.signToken(user, role, groupId, 'access');
    const refreshToken = this.signToken(user, role, groupId, 'refresh');
    return { accessToken, refreshToken };
  }

  async loginDevice(dto: { machineId: string; secretKey: string }) {

    // TODO: 운영 환경에서는 이 데이터를 .env 또는 외부 설정으로 옮겨야 합니다.
    const deviceSecrets = {
      'MACHINE-0001': 'SUPER_SECRET_KEY_1',
      'MACHINE-0002': 'SUPER_SECRET_KEY_2',
    };

    const isValid = deviceSecrets[dto.machineId] === dto.secretKey;

    if (!isValid) {
      throw new UnauthorizedException('Machine ID 또는 Secret Key가 유효하지 않습니다.');
    }

    // 기기 전용 토큰 생성 (페이로드에 type: 'device' 추가)
    const payload = { sub: dto.machineId, type: 'device' };
    

    const token = this.jwtService.sign(payload, {
      expiresIn: '365d', // 기기 토큰은 긴 만료 시간 설정
    });


    return {
      success: true,
      data: {
        accessToken: token,
      }
    };
  }
}
