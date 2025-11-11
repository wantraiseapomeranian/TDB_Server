import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/users.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Machine } from '../machine/entities/machine.entity';

@Injectable()
export class FamilyService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserGroup)
    private readonly groupRepo: Repository<UserGroup>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepo: Repository<UserGroupMembership>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
  ) {}

  // 사용자 ID로 가족 구성원 목록 조회
  async getFamilyMembersByUserId(userId: string): Promise<{ success: boolean; data: any[] }> {
    // 먼저 요청한 사용자의 그룹 정보 조회
    const membership = await this.membershipRepo.findOne({
      where: { user_id: userId },
      relations: ['group']
    });

    if (!membership) {
      throw new NotFoundException('사용자의 그룹 정보를 찾을 수 없습니다.');
    }

    // 같은 그룹의 모든 구성원 조회
    const familyMembers = await this.membershipRepo
      .createQueryBuilder('membership')
      .innerJoin('membership.user', 'user')
      .where('membership.group_id = :group_id', { group_id: membership.group_id })
      .select([
        'user.user_id',
        'user.name',
        'user.birthDate',
        'user.age',
        'user.took_today',
        'user.k_uid',
        'membership.role',
        'membership.joined_at'
      ])
      .getRawMany();

    const formattedMembers = familyMembers.map(member => ({
      user_id: member.user_user_id,
      name: member.user_name,
      role: member.membership_role,
      birthDate: member.user_birthDate,
      age: member.user_age,
      took_today: member.user_took_today,
      k_uid: member.user_k_uid,
      joined_at: member.membership_joined_at,
      group_id: membership.group_id
    }));

    return {
      success: true,
      data: formattedMembers,
    };
  }

  // 그룹 ID로 가족 구성원 목록 조회 (대시보드용)
  async getFamilyMembersByGroupId(group_id: string): Promise<{ success: boolean; data: any[] }> {
    if (!group_id) {
      throw new BadRequestException('그룹 정보가 필요합니다.');
    }

    // 해당 그룹의 모든 구성원 조회
    const familyMembers = await this.membershipRepo
      .createQueryBuilder('membership')
      .innerJoin('membership.user', 'user')
      .where('membership.group_id = :group_id', { group_id })
      .select([
        'user.user_id',
        'user.name',
        'user.birthDate',
        'user.age',
        'user.took_today',
        'user.k_uid',
        'membership.role',
        'membership.joined_at'
      ])
      .getRawMany();

    const formattedMembers = familyMembers.map(member => ({
      user_id: member.user_user_id,
      name: member.user_name,
      role: member.membership_role,
      birthDate: member.user_birthDate,
      age: member.user_age,
      took_today: member.user_took_today,
      k_uid: member.user_k_uid,
      joined_at: member.membership_joined_at,
      group_id: group_id
    }));

    return {
      success: true,
      data: formattedMembers,
    };
  }

  // 부모 그룹 ID로 자녀 목록 조회
  async getFamilyMembersByParentGroupId(group_id: string): Promise<any[]> {
    const group = await this.groupRepo.findOne({
      where: { group_id }
    });

    if (!group) {
      throw new NotFoundException('그룹을 찾을 수 없습니다.');
    }

    // 해당 그룹의 자녀 구성원들만 조회
    const children = await this.membershipRepo
      .createQueryBuilder('membership')
      .innerJoin('membership.user', 'user')
      .where('membership.group_id = :group_id', { group_id })
      .andWhere('membership.role = :role', { role: UserRole.CHILD })
      .select([
        'user.user_id',
        'user.name',
        'user.birthDate',
        'user.age',
        'user.took_today',
        'user.k_uid',
        'membership.role',
        'membership.joined_at'
      ])
      .getRawMany();

    return children.map(child => ({
      user_id: child.user_user_id,
      name: child.user_name,
      role: child.membership_role,
      birthDate: child.user_birthDate,
      age: child.user_age,
      took_today: child.user_took_today,
      k_uid: child.user_k_uid,
      joined_at: child.membership_joined_at,
      group_id: group_id
    }));
  }

  // 자녀 구성원 추가
  async addFamilyMember(data: {
    user_id: string;
    uid: string;
    name: string;
    birthDate: string;
    age: number;
    parentUserId: string;
  }): Promise<any> {
    // 중복 체크
    const existing = await this.userRepo.findOne({
      where: [{ user_id: data.user_id }, { k_uid: data.uid }],
    });

    if (existing) {
      throw new ConflictException('이미 등록된 구성원입니다.');
    }

    // 부모의 그룹 정보 조회
    const parentMembership = await this.membershipRepo.findOne({
      where: { user_id: data.parentUserId, role: UserRole.PARENT },
      relations: ['group']
    });

    if (!parentMembership) {
      throw new NotFoundException('부모 사용자의 그룹 정보를 찾을 수 없습니다.');
    }

    // 자식 사용자 생성
    const childUser = this.userRepo.create({
      user_id: data.user_id,
      name: data.name,
      birthDate: new Date(data.birthDate),
      age: data.age,
      k_uid: data.uid,
      took_today: 0, // boolean이 아닌 number 타입
    });

    const savedChild = await this.userRepo.save(childUser);

    // 자식을 부모의 그룹에 추가
    const childMembership = this.membershipRepo.create({
      group_id: parentMembership.group_id,
      user_id: savedChild.user_id,
      role: UserRole.CHILD,
      joined_at: new Date(),
    });

    await this.membershipRepo.save(childMembership);

    console.log(`[FamilyService] 자식 계정 생성: ${data.name}`);
    console.log(`  부모 그룹: ${parentMembership.group_id}`);
    console.log(`  자식 user_id: ${savedChild.user_id}`);

    return {
      user_id: savedChild.user_id,
      name: savedChild.name,
      role: UserRole.CHILD,
      birthDate: savedChild.birthDate,
      age: savedChild.age,
      group_id: parentMembership.group_id,
      joined_at: childMembership.joined_at
    };
  }

  // 자녀 정보 수정
  async updateFamilyMember(id: string, updateData: Partial<User>) {
    // 자녀인지 확인
    const membership = await this.membershipRepo.findOne({
      where: { user_id: id, role: UserRole.CHILD },
      relations: ['user']
    });

    if (!membership) {
      throw new NotFoundException('해당 구성원을 찾을 수 없습니다.');
    }

    // birthDate가 문자열로 들어오면 Date로 변환
    if (updateData.birthDate && typeof updateData.birthDate === 'string') {
      updateData.birthDate = new Date(updateData.birthDate);
    }

    Object.assign(membership.user, updateData);
    const savedUser = await this.userRepo.save(membership.user);

    return {
      user_id: savedUser.user_id,
      name: savedUser.name,
      role: membership.role,
      birthDate: savedUser.birthDate,
      age: savedUser.age,
      group_id: membership.group_id
    };
  }

  // 자녀 삭제
  async deleteFamilyMember(id: string): Promise<{ success: true }> {
    // 자녀인지 확인하고 멤버십 삭제
    const membership = await this.membershipRepo.findOne({
      where: { user_id: id, role: UserRole.CHILD }
    });

    if (!membership) {
      throw new NotFoundException('삭제할 구성원을 찾을 수 없습니다.');
    }

    // 멤버십 삭제
    await this.membershipRepo.remove(membership);

    // 사용자 삭제
    await this.userRepo.delete({ user_id: id });

    return { success: true };
  }

  // 전체 자녀 스케줄 요약 (그룹 기반)
  async getFamilySummary(group_id: string) {
    // 해당 그룹의 자녀들만 조회
    const children = await this.membershipRepo
      .createQueryBuilder('membership')
      .innerJoin('membership.user', 'user')
      .leftJoin('user.schedules', 'schedule')
      .where('membership.group_id = :group_id', { group_id })
      .andWhere('membership.role = :role', { role: UserRole.CHILD })
      .select([
        'user.user_id',
        'user.name',
        'COUNT(schedule.schedule_id) as schedule_count'
      ])
      .groupBy('user.user_id, user.name')
      .getRawMany();

    return children.map((child) => ({
      memberId: child.user_user_id,
      memberName: child.user_name,
      activeMedicines: parseInt(child.schedule_count) || 0,
      todayCompleted: 0, // 별도 로직으로 계산 필요
      todayTotal: parseInt(child.schedule_count) || 0,
      upcomingRefills: 0, // 별도 로직으로 계산 필요
    }));
  }

  // 🔥 기기 연동 상태 확인
  async checkMachineConnection(machine_id: string) {
    try {
      // 기기 정보 조회
      const machine = await this.machineRepo.findOne({
        where: { machine_id },
        relations: ['group']
      });

      if (!machine) {
        throw new NotFoundException('등록되지 않은 기기입니다.');
      }

      // 기기가 그룹에 연결되어 있는지 확인
      const isConnected = !!machine.group_id;
      
      // 기기 상태 정보 반환
      return {
        machine_id: machine.machine_id,
        group_id: machine.group_id,
        connected: isConnected,
        max_slot: machine.max_slot,
        error_status: machine.error_status,
        last_error_at: machine.last_error_at,
        registration_date: null, // Machine 엔티티에 created_at 필드가 없음
        status: isConnected ? 'connected' : 'not_connected'
      };
    } catch (error) {
      console.error('🔥 [FamilyService] 기기 연동 상태 확인 오류:', error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException('기기 연동 상태 확인 중 오류가 발생했습니다.');
    }
  }
}
