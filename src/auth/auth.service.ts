import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async signup(params: SignupParams) {
    this.logger.log(`--- [AuthService] Received Signup Params ---`);
    this.logger.log(JSON.stringify(params, null, 2));

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

    this.logger.log(
      `회원가입 요청 처리 중 - ID: ${id}, Role: ${role || accountType}`,
    );

    try {
      const existingUser = await this.userRepository.findOne({
        where: { user_id: id },
      });

      if (existingUser) {
        this.logger.warn(`[signup] 중복된 ID 사용 시도: ${id}`);
        throw new ConflictException('이미 등록된 사용자입니다.');
      }

      const hashedPassword = await bcrypt.hash(
        password,
        parseInt(process.env.HASH_ROUNDS || '10'),
      );
      this.logger.debug(`[signup] 비밀번호 해시 완료`);

      const userRole: UserRole = (role || accountType) as UserRole;

      if (!Object.values(UserRole).includes(userRole)) {
        this.logger.error(`[signup] 유효하지 않은 역할 입력: ${userRole}`);
        throw new ConflictException(
          'role은 "parent" 또는 "child"만 허용됩니다.',
        );
      }

      // 사용자 엔터티 생성
      const user = this.userRepository.create({
        user_id: id,
        password: hashedPassword,
        name,
        birthDate: new Date(birthDate),
        age,
        took_today: 0,
      });

      this.logger.debug(`[signup] 저장될 사용자 객체: ${JSON.stringify(user)}`);

      const savedUser = await this.userRepository.save(user);

      if (!savedUser || !savedUser.user_id) {
        this.logger.error(
          `[signup] 저장 실패 - 반환값이 없음 또는 user_id 없음`,
        );
        throw new ConflictException(
          '회원가입 저장에 실패했습니다. 필수 정보가 누락됐을 수 있습니다.',
        );
      }

      let groupId: string;
      let group: UserGroup;

      if (userRole === UserRole.PARENT) {
        // 부모 사용자인 경우 새 그룹 생성
        groupId = uuidv4();
        const finalGroupName = groupName || `${name}님의 가족`; // 🔥 사용자 입력 그룹명 우선 사용
        group = this.userGroupRepository.create({
          group_id: groupId,
          group_name: finalGroupName,
          parent_user_id: savedUser.user_id,
          note: 'Auto-created family group',
        });
        
        await this.userGroupRepository.save(group);
        this.logger.debug(`[signup] 새 그룹 생성 완료 - group_id: ${groupId}, group_name: ${finalGroupName}`);
      } else {
        // 자녀 사용자인 경우 기존 그룹에 참여
        let targetGroupId = parentGroupId;

        // 🔥 parentUuid가 제공된 경우, 부모의 group_id를 찾기
        if (!targetGroupId && parentUuid) {
          this.logger.debug(`[signup] parentUuid로 부모 그룹 찾기: ${parentUuid}`);
          
          // 부모의 멤버십 정보를 통해 group_id 찾기
          const parentMembership = await this.membershipRepository.findOne({
            where: { user_id: parentUuid },
          });

          if (!parentMembership) {
            this.logger.warn(`[signup] 부모 사용자(${parentUuid})의 멤버십 정보를 찾을 수 없음`);
            throw new ConflictException('지정된 부모 계정을 찾을 수 없습니다.');
          }

          targetGroupId = parentMembership.group_id;
          this.logger.debug(`[signup] 부모의 group_id 찾음: ${targetGroupId}`);
        }

        if (!targetGroupId) {
          this.logger.error(`[signup] 서브 계정인데 parentGroupId와 parentUuid가 모두 없음`);
          throw new ConflictException('서브 계정은 부모 그룹 ID 또는 부모 계정 ID가 필요합니다.');
        }

        group = await this.userGroupRepository.findOne({
          where: { group_id: targetGroupId },
        });

        if (!group) {
          this.logger.warn(
            `[signup] 그룹 ID(${targetGroupId})로 그룹 찾기 실패`,
          );
          throw new ConflictException(
            '해당 그룹을 찾을 수 없습니다.',
          );
        }

        groupId = targetGroupId;
        this.logger.debug(`[signup] 기존 그룹 참여 - group_id: ${groupId}`);
      }

      // 멤버십 생성
      const membership = this.membershipRepository.create({
        group_id: groupId,
        user_id: savedUser.user_id,
        role: userRole,
      });

      await this.membershipRepository.save(membership);

      this.logger.log(
        `[signup] 회원가입 완료 - ID: ${savedUser.user_id}, Role: ${userRole}, Group: ${groupId}`,
      );

      // 회원가입 성공 시 토큰 생성
      const accessToken = this.signToken(savedUser, userRole, groupId, 'access');
      const refreshToken = this.signToken(savedUser, userRole, groupId, 'refresh');

      // refresh token을 데이터베이스에 저장
      await this.userRepository.update(savedUser.user_id, {
        refresh_token: refreshToken,
      });

      this.logger.log(`[signup] 토큰 생성 및 저장 완료 - ID: ${savedUser.user_id}`);

      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          id: savedUser.user_id,
          name: savedUser.name,
          role: userRole,
          groupId: groupId,
          groupName: group.group_name, // 🔥 그룹명 추가
          birthDate: savedUser.birthDate,
          age: savedUser.age,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[signup] 회원가입 중 오류 발생: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async login(id: string, password: string) {
    this.logger.log(`로그인 요청 - ID: ${id}`);

    const user = await this.userRepository.findOne({ where: { user_id: id } });

    if (!user) {
      this.logger.warn(`로그인 실패 - 존재하지 않는 ID: ${id}`);
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`비밀번호 불일치 - ID: ${id}`);
      throw new UnauthorizedException('비밀번호가 올바르지 않습니다.');
    }

    // 사용자의 멤버십 정보 조회
    const membership = await this.membershipRepository.findOne({
      where: { user_id: id },
      relations: ['group'],
    });

    if (!membership) {
      this.logger.error(`멤버십 정보 없음 - ID: ${id}`);
      throw new UnauthorizedException('사용자의 그룹 정보를 찾을 수 없습니다.');
    }

    const accessToken = this.signToken(user, membership.role, membership.group_id, 'access');
    const refreshToken = this.signToken(user, membership.role, membership.group_id, 'refresh');

    await this.userRepository.update(user.user_id, {
      refresh_token: refreshToken,
    });

    this.logger.log(`로그인 성공 - ID: ${id}, Token 발급 완료`);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        id: user.user_id,
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
    this.logger.debug(`JWT 생성 - Type: ${type}, Exp: ${expiresIn}`);
    return this.jwtService.sign(payload, { expiresIn });
  }

  async updateRefreshToken(userId: string, token: string): Promise<void> {
    this.logger.debug(`Refresh Token 저장 - ID: ${userId}`);
    await this.userRepository.update(userId, { refresh_token: token });
  }

  async logout(id: string) {
    this.logger.log(`로그아웃 요청 - ID: ${id}`);

    try {
      const user = await this.userRepository.findOne({
        where: { user_id: id },
      });

      if (!user) {
        this.logger.warn(`로그아웃 실패 - 존재하지 않는 ID: ${id}`);
        throw new UnauthorizedException('존재하지 않는 사용자입니다.');
      }

      await this.userRepository.update(user.user_id, {
        refresh_token: '',
      });

      this.logger.log(`로그아웃 성공 - ID: ${id}`);

      return {
        success: true,
        message: '로그아웃이 완료되었습니다.',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`로그아웃 실패 - ID: ${id}, Error: ${errorMessage}`);
      throw error;
    }
  }

  async checkAuth(user: TokenPayload) {
    this.logger.log(`사용자 인증 확인 요청 - sub: ${user.sub}`);

    const foundUser = await this.userRepository.findOne({
      where: { user_id: user.sub },
    });

    if (!foundUser) {
      this.logger.warn(`checkAuth 실패 - 사용자 없음: ${user.sub}`);
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
      this.logger.warn(`잘못된 토큰 형식: ${header}`);
      throw new UnauthorizedException(`${type} 형식의 인증 토큰이 아닙니다.`);
    }
    return header.slice(type.length).trim();
  }

  decodeBasicToken(token: string): { id: string; password: string } {
    this.logger.debug(`Basic 토큰 디코딩 시도`);
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [id, password] = decoded.split(':');
      this.logger.debug(`디코딩 성공 - ID: ${id}`);
      if (!id || !password) throw new Error();
      return { id, password };
    } catch {
      this.logger.error(`Basic 토큰 디코딩 실패`);
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
    this.logger.debug(`ID/PW 인증 시도 - ID: ${id}`);
    const user = await this.userRepository.findOne({
      where: { user_id: id },
    });

    if (!user) {
      this.logger.warn(`인증 실패 - ID 없음: ${id}`);
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      this.logger.warn(`인증 실패 - 비밀번호 불일치`);
      throw new UnauthorizedException('비밀번호가 일치하지 않습니다.');
    }

    // 멤버십 정보 조회
    const membership = await this.membershipRepository.findOne({
      where: { user_id: id },
    });

    this.logger.log(`인증 성공 - ID: ${id}`);
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
    this.logger.log(`[Device] 로그인 인증 시작: ${dto.machineId}`);

    // TODO: 운영 환경에서는 이 데이터를 .env 또는 외부 설정으로 옮겨야 합니다.
    const deviceSecrets = {
      'MACHINE-0001': 'SUPER_SECRET_KEY_1',
      'MACHINE-0002': 'SUPER_SECRET_KEY_2',
    };

    const isValid = deviceSecrets[dto.machineId] === dto.secretKey;

    if (!isValid) {
      this.logger.warn(`[Device] 로그인 실패: ${dto.machineId}의 Secret Key 불일치`);
      throw new UnauthorizedException('Machine ID 또는 Secret Key가 유효하지 않습니다.');
    }

    // 기기 전용 토큰 생성 (페이로드에 type: 'device' 추가)
    const payload = { sub: dto.machineId, type: 'device' };
    
    this.logger.debug(`[Device] JWT 페이로드 생성: ${JSON.stringify(payload)}`);

    const token = this.jwtService.sign(payload, {
      expiresIn: '365d', // 기기 토큰은 긴 만료 시간 설정
    });

    this.logger.log(`[Device] 로그인 성공, 토큰 발급: ${dto.machineId}`);

    return {
      success: true,
      data: {
        accessToken: token,
      }
    };
  }
}
