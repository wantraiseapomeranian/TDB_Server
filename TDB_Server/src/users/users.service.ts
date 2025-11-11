import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/users.entity';
import { UserRole } from './entities/user-role.enum';
import { UserGroup } from './entities/user-group.entity';
import { UserGroupMembership } from './entities/user-group-membership.entity';
import { Machine } from '../machine/entities/machine.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserGroup)
    private readonly userGroupRepository: Repository<UserGroup>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
  ) {}

  async resolveRfid(uid: string) {
    // 1. DB의 'k_uid' 컬럼에서 전달받은 uid와 일치하는 사용자를 찾습니다.
    const user = await this.usersRepository.findOne({ where: { k_uid: uid } });

    // 2. 사용자를 찾지 못했다면, 미등록 키트 응답을 반환합니다.
    if (!user) {
      return {
        registered: false,
        register_url: `https://app.example.com/kit/register?uid=${uid}`,
      };
    }
    
    // 3. 사용자를 찾았다면, 해당 유저의 그룹 정보를 찾습니다.
    const membership = await this.membershipRepository.findOne({
      where: { user_id: user.user_id },
    });
    
    // 4. 명세에 맞는 최종 응답을 반환합니다.
    return {
      registered: true,
      user_id: user.user_id,
      group_id: membership ? membership.group_id : null, // 멤버십이 없을 경우 null 처리
      took_today: user.took_today,
    };
  }

  /**
   * 새로운 사용자 생성 (그룹 및 멤버십 포함)
   */
  async createUser(userData: Partial<User>, role: UserRole = UserRole.CHILD, parentUserId?: string): Promise<User> {
    console.log('[UsersService] 새 사용자 생성 시작:', userData);

    // 1. 사용자 생성
    const newUser = this.usersRepository.create({
      user_id: userData.user_id,
      password: userData.password,
      name: userData.name,
      age: userData.age,
      birthDate: userData.birthDate,
      k_uid: userData.k_uid,
      refresh_token: userData.refresh_token,
    });

    const savedUser = await this.usersRepository.save(newUser);

    // 2. 그룹 처리
    let group: UserGroup;
    
    if (role === UserRole.PARENT) {
      // 부모인 경우 새 그룹 생성
      group = this.userGroupRepository.create({
        group_id: randomUUID(),
        group_name: `${savedUser.name}의 가족`,
        parent_user_id: savedUser.user_id,
        note: '자동 생성된 가족 그룹'
      });
      group = await this.userGroupRepository.save(group);
    } else {
      // 자녀인 경우 부모의 그룹에 참여
      if (!parentUserId) {
        throw new BadRequestException('자녀 계정 생성 시 부모 ID가 필요합니다.');
      }
      
      const parentMembership = await this.membershipRepository.findOne({
        where: { user_id: parentUserId, role: UserRole.PARENT },
        relations: ['group']
      });
      
      if (!parentMembership) {
        throw new NotFoundException('부모 계정의 그룹을 찾을 수 없습니다.');
      }
      
      group = parentMembership.group;
    }

    // 3. 멤버십 생성
    const membership = this.membershipRepository.create({
      group_id: group.group_id,
      user_id: savedUser.user_id,
      role: role
    });
    await this.membershipRepository.save(membership);

    console.log(`[UsersService] 사용자 생성 완료: ${savedUser.user_id} (${role}) → 그룹: ${group.group_id}`);
    
    return savedUser;
  }

  /**
   * 전체 유저 조회
   */
  async getAllUsers(): Promise<User[]> {
    return this.usersRepository.find();
  }

  /**
   * ID로 유저 조회
   */
  async getUserById(user_id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { user_id } });
  }

  /**
   * 키트 UID로 유저 조회
   */
  async getUserByKitUid(k_uid: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { k_uid } });
  }

  /**
   * 사용자의 그룹 정보 조회
   */
  async getUserWithGroup(userId: string): Promise<{ user: User; group: UserGroup; membership: UserGroupMembership }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const membership = await this.membershipRepository.findOne({
      where: { user_id: userId },
      relations: ['group']
    });

    if (!membership) {
      throw new NotFoundException('사용자의 그룹 정보를 찾을 수 없습니다.');
    }

    return { user, group: membership.group, membership };
  }

  /**
   * 그룹의 모든 멤버 조회
   */
  async getGroupMembers(groupId: string): Promise<{ user: User; membership: UserGroupMembership }[]> {
    const memberships = await this.membershipRepository.find({
      where: { group_id: groupId },
      relations: ['user']
    });

    return memberships.map(membership => ({
      user: membership.user,
      membership
    }));
  }

  /**
   * 부모 ID 기준 자식 계정 목록 조회
   */
  async getChildrenOfParent(parentUserId: string): Promise<User[]> {
    // 1. 부모의 그룹 찾기
    const parentMembership = await this.membershipRepository.findOne({
      where: { user_id: parentUserId, role: UserRole.PARENT }
    });

    if (!parentMembership) {
      throw new NotFoundException('부모 계정을 찾을 수 없습니다.');
    }

    // 2. 같은 그룹의 자녀들 찾기
    const childMemberships = await this.membershipRepository.find({
      where: { group_id: parentMembership.group_id, role: UserRole.CHILD },
      relations: ['user']
    });

    return childMemberships.map(membership => membership.user);
  }

  /**
   * refresh_token으로 유저 조회
   */
  async getUserByRefreshToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { refresh_token: token },
    });
  }

  /**
   * 유저 정보 업데이트
   */
  async updateUser(user_id: string, update: Partial<User>): Promise<User> {
    const user = await this.getUserById(user_id);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    Object.assign(user, update);
    return this.usersRepository.save(user);
  }

  /**
   * 🔥 디스펜서 등록 (Machine 테이블에 등록)
   */
  async registerDispenser(userId: string, machine_id: string): Promise<{ message: string; machine: Machine }> {
    const { user, group, membership } = await this.getUserWithGroup(userId);

    // 부모 계정만 기기 등록 가능
    if (membership.role !== UserRole.PARENT) {
      throw new BadRequestException('메인 계정만 디스펜서를 등록할 수 있습니다.');
    }

    // 이미 등록된 기기인지 확인
    const existingMachine = await this.machineRepository.findOne({
      where: { machine_id: machine_id }
    });

    if (existingMachine) {
      throw new BadRequestException('이미 등록된 디스펜서입니다.');
    }

    // 새 기기 등록
    const newMachine = this.machineRepository.create({
      machine_id: machine_id,
      group_id: group.group_id,
      max_slot: 3, // 기본 3슬롯
      error_status: null,
      last_error_at: null
    });

    const savedMachine = await this.machineRepository.save(newMachine);

    console.log(`[UsersService] 디스펜서 등록 완료: ${machine_id} → 그룹: ${group.group_id}`);
    
    return {
      message: '디스펜서가 성공적으로 등록되었습니다.',
      machine: savedMachine
    };
  }

  /**
   * 🔥 데일리 키트 등록 (k_uid 업데이트)
   */
  async registerDailyKit(userId: string, k_uid: string): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 이미 다른 사용자가 해당 k_uid를 사용 중인지 확인
    const existingUser = await this.usersRepository.findOne({ 
      where: { k_uid },
    });
    
    if (existingUser && existingUser.user_id !== userId) {
      throw new BadRequestException('이미 등록된 데일리 키트입니다.');
    }

    // 사용자의 k_uid 업데이트
    user.k_uid = k_uid;
    const updatedUser = await this.usersRepository.save(user);
    
    console.log(`[UsersService] 데일리 키트 등록 완료: ${userId} -> ${k_uid}`);
    return updatedUser;
  }

  /**
   * 🔥 디스펜서 정보 조회
   */
  async getDispenserInfo(userId: string): Promise<{ machines: Machine[]; group_id: string }> {
    const { group } = await this.getUserWithGroup(userId);

    const machines = await this.machineRepository.find({
      where: { group_id: group.group_id }
    });

    console.log(`[UsersService] 디스펜서 정보 조회: userId=${userId}, 그룹=${group.group_id}, 기기 수=${machines.length}`);
    
    return {
      machines,
      group_id: group.group_id
    };
  }

  /**
   * 그룹 정보 조회
   */
  async getGroupInfo(groupId: string): Promise<UserGroup> {
    const group = await this.userGroupRepository.findOne({
      where: { group_id: groupId }
    });

    if (!group) {
      throw new NotFoundException('그룹을 찾을 수 없습니다.');
    }

    return group;
  }
}
