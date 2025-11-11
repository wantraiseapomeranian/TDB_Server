import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '../shared/entities/medicine.entity';
import { Machine } from '../machine/entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { User } from '../users/entities/users.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { MachineService } from '../machine/machine.service'; // 추가
import { randomUUID } from 'crypto';

@Injectable()
export class SupplementService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicineRepo: Repository<Medicine>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    @InjectRepository(MachineSlot)
    private readonly machineSlotRepo: Repository<MachineSlot>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepo: Repository<UserGroupMembership>,
    
    // 공통 슬롯 할당 서비스 주입
    private readonly machineService: MachineService,
  ) {}

  // 사용자의 그룹 정보 조회 헬퍼
  private async getUserGroup(userId: string) {
    const membership = await this.membershipRepo.findOne({
      where: { user_id: userId },
      relations: ['group']
    });
    
    if (!membership) {
      throw new NotFoundException('사용자의 그룹 정보를 찾을 수 없습니다.');
    }
    
    return { group: membership.group, membership };
  }

  // 영양제 목록 조회
  async getSupplements(userId: string) {
    const { group } = await this.getUserGroup(userId);
    
    const supplements = await this.medicineRepo.find({
      where: { group_id: group.group_id },
    });

    const supplementsWithMachine = await Promise.all(
      supplements.map(async (supplement) => {
        // MachineSlot에서 해당 영양제 정보 조회
        const machineSlot = await this.machineSlotRepo.findOne({
          where: { medi_id: supplement.medi_id },
          relations: ['machine']
        });

        return {
          ...supplement,
          slot: machineSlot?.slot_number || null,
          total: machineSlot?.total || null,
          remain: machineSlot?.remain || null,
          machine_id: machineSlot?.machine_id || null,
          totalQuantity: machineSlot?.total?.toString() || null,
        };
      })
    );

    return supplementsWithMachine;
  }

  // 🔥 기존 슬롯 관련 메서드들 제거하고 공통 서비스 사용
  // async findMachinesByGroup() - 제거됨
  // async getUsedSlots() - 제거됨  
  // async autoAssignSlot() - 제거됨

  // 영양제 추가 (공통 슬롯 할당 서비스 사용) - 🔥 의약품과 동일하게 0으로 시작
  async addSupplement(userId: string, data: {
    medi_id: string;
    name: string;
    totalQuantity: string;
    slot?: number;
  }) {
    const { group } = await this.getUserGroup(userId);
    
    // 부모 권한 확인
    const parentMembership = await this.membershipRepo.findOne({
      where: { group_id: group.group_id, role: UserRole.PARENT },
      relations: ['user']
    });

    if (!parentMembership) {
      throw new NotFoundException('부모 계정을 찾을 수 없습니다.');
    }

    // 이미 존재하는 영양제인지 확인
    const existingSupplement = await this.medicineRepo.findOne({
      where: { medi_id: data.medi_id, group_id: group.group_id },
    });

    if (existingSupplement) {
      throw new BadRequestException('이미 등록된 영양제입니다.');
    }

    // 🎯 공통 슬롯 할당 서비스 사용 - 의약품과 동일하게 처리
    // const totalQuantity = parseInt(data.totalQuantity); // 🔥 제거: 즉시 설정하지 않음
    
    // 1. 슬롯 할당
    const slotResult = await this.machineService.assignSlot(group.group_id, data.slot);
    
    if (!slotResult.success) {
      throw new BadRequestException(slotResult.error || '슬롯 할당 실패');
    }

    // 영양제 등록
    const supplement = this.medicineRepo.create({
      medi_id: data.medi_id,
      group_id: group.group_id,
      name: data.name,
      warning: 0,
      start_date: new Date(),
      end_date: null,
      target_users: null,
      listed_only: 1
    });

    const savedSupplement = await this.medicineRepo.save(supplement);

    // 2. 슬롯 예약 - 🔥 의약품과 동일하게 0으로 시작 (나중에 업데이트)
    const initialTotal = 0; // 🔥 의약품과 동일: 0으로 시작
    const reserveResult = await this.machineService.reserveSlot(
      group.group_id, 
      data.medi_id, 
      slotResult.slot!, 
      initialTotal
    );

    if (!reserveResult.success) {
      throw new BadRequestException(reserveResult.error || '슬롯 예약 실패');
    }

    console.log(`🔥 [SupplementService] 영양제 슬롯 할당: ${data.medi_id} → 슬롯 ${slotResult.slot}번 (총량: ${initialTotal})`);
    console.log(`🔥 [SupplementService] 총량은 나중에 별도 업데이트에서 설정됩니다.`);

    return {
      success: true,
      data: {
        supplement: savedSupplement,
        slot: slotResult.slot,
        total: initialTotal, // 🔥 의약품과 동일: 0으로 반환
      },
      message: `영양제가 ${slotResult.slot}번 슬롯에 등록되었습니다. (총량은 나중에 설정)`,
    };
  }

  // 영양제 수정
  async updateSupplement(userId: string, medi_id: string, data: {
    name?: string;
    totalQuantity?: string;
  }) {
    const { group } = await this.getUserGroup(userId);
    
    const supplement = await this.medicineRepo.findOne({
      where: { group_id: group.group_id, medi_id },
    });

    if (!supplement) {
      throw new NotFoundException('영양제를 찾을 수 없습니다.');
    }

    // 영양제 정보 업데이트
    if (data.name) {
      supplement.name = data.name;
    }

    const updatedSupplement = await this.medicineRepo.save(supplement);

    // 총량 업데이트 (있는 경우)
    if (data.totalQuantity) {
      const machineSlot = await this.machineSlotRepo.findOne({
        where: { medi_id }
      });

      if (machineSlot) {
        const newTotal = parseInt(data.totalQuantity);
        machineSlot.total = newTotal;
        machineSlot.remain = newTotal;
        await this.machineSlotRepo.save(machineSlot);
      }
    }

    return updatedSupplement;
  }

  // 영양제 총량 업데이트 (의약품과 동일한 방식)
  async updateSupplementQuantity(userId: string, mediId: string, totalQuantity: number) {
    try {
      const { group } = await this.getUserGroup(userId);
      
      // 부모 권한 확인
      const parentMembership = await this.membershipRepo.findOne({
        where: { group_id: group.group_id, role: UserRole.PARENT },
        relations: ['user']
      });

      if (!parentMembership) {
        throw new NotFoundException('부모 계정을 찾을 수 없습니다.');
      }

      // 영양제 존재 여부 확인
      const supplement = await this.medicineRepo.findOne({
        where: { medi_id: mediId, group_id: group.group_id },
      });

      if (!supplement) {
        throw new NotFoundException('등록된 영양제를 찾을 수 없습니다.');
      }

      // 슬롯 총량 업데이트
      const updateResult = await this.machineService.updateSlotQuantity(
        group.group_id,
        mediId,
        totalQuantity
      );

      if (!updateResult.success) {
        throw new BadRequestException(updateResult.error || '슬롯 총량 업데이트 실패');
      }

      console.log(`🔥 [SupplementService] 영양제 총량 업데이트: ${mediId} → ${totalQuantity}개`);

      return {
        success: true,
        data: {
          mediId,
          totalQuantity,
          updatedAt: new Date()
        },
        message: `영양제 총량이 ${totalQuantity}개로 업데이트되었습니다.`,
      };
    } catch (error) {
      console.error('🔥 [SupplementService] 영양제 총량 업데이트 오류:', error);
      throw error;
    }
  }

  // 영양제 목록 조회 (간단한 버전)
  async getSupplementList(userId: string) {
    const { group } = await this.getUserGroup(userId);
    
    const supplements = await this.medicineRepo.find({ 
      where: { group_id: group.group_id } 
    });
    
    return supplements;
  }

  // 영양제 삭제
  async deleteSupplement(userId: string, data: { supplementId: string }) {
    const { group } = await this.getUserGroup(userId);
    
    const supplement = await this.medicineRepo.findOne({
      where: { medi_id: data.supplementId, group_id: group.group_id },
    });

    if (!supplement) {
      throw new NotFoundException('영양제를 찾을 수 없습니다.');
    }

    // 기계 슬롯에서도 제거
    await this.machineSlotRepo.delete({ medi_id: data.supplementId });
    
    // 영양제 삭제
    await this.medicineRepo.remove(supplement);
    
    return { message: '영양제가 삭제되었습니다.' };
  }

  // 영양제 상세 정보 조회
  async getSupplementDetail(userId: string, data: { supplementId: string }) {
    const { group } = await this.getUserGroup(userId);
    
    const supplement = await this.medicineRepo.findOne({
      where: { medi_id: data.supplementId, group_id: group.group_id },
    });

    if (!supplement) {
      throw new NotFoundException('영양제를 찾을 수 없습니다.');
    }

    // 기계 슬롯 정보도 함께 조회
    const machineSlot = await this.machineSlotRepo.findOne({
      where: { medi_id: data.supplementId },
      relations: ['machine']
    });

    return {
      ...supplement,
      slot: machineSlot?.slot_number || null,
      total: machineSlot?.total || null,
      remain: machineSlot?.remain || null,
      machine_id: machineSlot?.machine_id || null,
    };
  }
}
