import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '../shared/entities/medicine.entity';
import { Machine } from '../machine/entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { MachineService } from '../machine/machine.service'; // 추가
import { Schedule } from '../schedule/entities/schedule.entity';
import { DoseHistory } from '../dose-history/dose-history.entity';

@Injectable()
export class MedicineService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,

    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,

    @InjectRepository(MachineSlot)
    private readonly machineSlotRepository: Repository<MachineSlot>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,

    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,

    @InjectRepository(DoseHistory)
    private readonly doseHistoryRepository: Repository<DoseHistory>,

    // 공통 슬롯 할당 서비스 주입
    private readonly machineService: MachineService,
  ) {}

  // 헬퍼 메서드: 사용자 그룹 정보 가져오기
  private async getUserGroup(userId: string) {
    const membership = await this.membershipRepository.findOne({
      where: { user_id: userId },
      relations: ['group'],
    });

    if (!membership) {
      throw new NotFoundException('사용자의 그룹을 찾을 수 없습니다.');
    }

    return membership.group;
  }

  // 🔄 슬롯 자동 할당 헬퍼 메서드들
  private async findMachinesByGroup(groupId: string) {
    return await this.machineRepository.find({
      where: { group_id: groupId }
    });
  }

  // 🔥 기존 슬롯 관련 메서드들 제거하고 공통 서비스 사용
  // private async getUsedSlots() - 제거됨
  // private async autoAssignSlot() - 제거됨

  /**
   * 1. 약물 목록 조회 (그룹 기반) - 🔥 슬롯 정보 및 권한 정보 포함하도록 수정
   */
  async getMedicineList(userId: string) {
    try {
      const group = await this.getUserGroup(userId);
      
      // 🔥 현재 사용자의 권한 확인 (부모인지 자식인지)
      const currentUserMembership = await this.membershipRepository.findOne({
        where: { user_id: userId },
        relations: ['group']
      });

      if (!currentUserMembership) {
        throw new NotFoundException('사용자 정보를 찾을 수 없습니다.');
      }

      const isParent = currentUserMembership.role === 'parent';
      
      const medicines = await this.medicineRepository.find({
        where: { group_id: group.group_id },
        order: { medi_id: 'ASC' },
      });

      console.log(`🔥 [MedicineService] 약물 목록 조회: 그룹 ${group.group_id}, 개수 ${medicines.length}, 사용자 권한: ${currentUserMembership.role}`);

      // 🔥 각 약물에 대해 슬롯 정보와 권한 정보도 함께 조회
      const medicinesWithSlots = await Promise.all(
        medicines.map(async (medicine) => {
          // 해당 그룹의 기계 조회
          const machines = await this.machineRepository.find({
            where: { group_id: group.group_id }
          });

          let slotInfo = null;
          if (machines.length > 0) {
            // 첫 번째 기계에서 슬롯 정보 조회
            slotInfo = await this.machineSlotRepository.findOne({
              where: { 
                machine_id: machines[0].machine_id,
                medi_id: medicine.medi_id
              }
            });
          }

          // 🔥 권한 계산 로직
          let permission = 'own'; // 기본값
          let ownerInfo = {
            isCommon: false,
            ownerName: ''
          };

          if (!medicine.target_users || medicine.target_users.length === 0) {
            // 가족 공통 약물
            permission = 'common';
            ownerInfo.isCommon = true;
          } else if (medicine.target_users.includes(userId)) {
            // 현재 사용자에게 할당된 약물
            permission = 'own';
          } else {
            // 다른 사용자에게 할당된 약물
            if (isParent) {
              // 부모는 모든 약물을 관리할 수 있음
              permission = 'manage';
            } else {
              // 자식은 다른 사용자의 약물에 제한된 권한
              permission = 'others';
            }

            // 소유자 이름 조회
            if (medicine.target_users.length > 0) {
              const ownerUserId = medicine.target_users[0];
              const ownerMembership = await this.membershipRepository.findOne({
                where: { user_id: ownerUserId },
                relations: ['user']
              });
                             if (ownerMembership && ownerMembership.user) {
                 ownerInfo.ownerName = ownerMembership.user.name || '알 수 없음';
               }
            }
          }

          console.log(`🔥 [${medicine.name}] 권한 계산:`, {
            target_users: medicine.target_users,
            currentUser: userId,
            isParent,
            permission,
            ownerInfo
          });

          return {
            medi_id: medicine.medi_id,
            name: medicine.name,
            warning: medicine.warning === 1,
            start_date: medicine.start_date,
            end_date: medicine.end_date,
            target_users: medicine.target_users,
            listed_only: medicine.listed_only === 1,
            // 🔥 슬롯 정보 추가
            slot: slotInfo?.slot_number || null,
            total: slotInfo?.total || 0,
            remain: slotInfo?.remain || 0,
            machine_id: slotInfo?.machine_id || null,
            totalQuantity: slotInfo?.total?.toString() || null,
            // 🔥 권한 정보 추가
            permission,
            ownerInfo
          };
        })
      );

      return {
        success: true,
        data: medicinesWithSlots,
        message: '약물 목록을 조회했습니다.',
      };
    } catch (error) {
      console.error('🔥 [MedicineService] 약물 목록 조회 오류:', error);
      return {
        success: false,
        data: [],
        message: error.message || '약물 목록 조회에 실패했습니다.',
      };
    }
  }

  /**
   * 2. 약물 상세 조회
   */
  async getMedicineDetail(userId: string, mediId: string) {
    try {
      const group = await this.getUserGroup(userId);
      
      const medicine = await this.medicineRepository.findOne({
        where: { 
          medi_id: mediId,
          group_id: group.group_id,
        },
      });

      if (!medicine) {
        throw new NotFoundException('약물을 찾을 수 없습니다.');
      }

      // 관련 슬롯 정보도 함께 조회
      const machine = await this.machineRepository.findOne({
        where: { group_id: group.group_id },
      });

      let slotInfo = null;
      if (machine) {
        slotInfo = await this.machineSlotRepository.findOne({
          where: { 
            machine_id: machine.machine_id,
            medi_id: mediId,
          },
        });
      }

      return {
        success: true,
        data: {
          medi_id: medicine.medi_id,
          name: medicine.name,
          warning: medicine.warning === 1,
          start_date: medicine.start_date,
          end_date: medicine.end_date,
          target_users: medicine.target_users,
          listed_only: medicine.listed_only === 1,
          // 슬롯 정보 추가
          slot: slotInfo?.slot_number || null,
          total: slotInfo?.total || 0,
          remain: slotInfo?.remain || 0,
        },
        message: '약물 상세 정보를 조회했습니다.',
      };
    } catch (error) {
      console.error('🔥 [MedicineService] 약물 상세 조회 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '약물 상세 조회에 실패했습니다.',
      };
    }
  }

  /**
   * 3. 약물 등록 (공통 슬롯 할당 서비스 사용)
   */
  async saveMedicine(userId: string, medicineData: {
    name: string;
    start_date?: string;
    end_date?: string;
    target_users?: string[];
    slot?: number;
    total?: number;
  }) {
    try {
      const group = await this.getUserGroup(userId);
      
      // 새로운 약물 ID 생성
      const mediId = `medicine_${Date.now()}`;

      // 약물 정보 저장
      const medicine = this.medicineRepository.create({
        medi_id: mediId,
        group_id: group.group_id,
        name: medicineData.name,
        warning: 0, // 기본값: 경고 없음
        start_date: medicineData.start_date || new Date().toISOString().split('T')[0],
        end_date: medicineData.end_date,
        target_users: medicineData.target_users || [],
        listed_only: 0, // 기본값: 사용자 정의
      });

      const savedMedicine = await this.medicineRepository.save(medicine);

      // 🎯 공통 슬롯 할당 서비스 사용 (총량과 무관하게 항상 실행)
      let assignedSlotNumber = null;
      
      // 1. 슬롯 할당 (항상 실행)
      const slotResult = await this.machineService.assignSlot(group.group_id, medicineData.slot);
      
      if (!slotResult.success) {
        throw new BadRequestException(slotResult.error || '슬롯 할당 실패');
      }

      // 2. 슬롯 예약 (기본 총량으로 우선 생성, 나중에 스케줄에서 업데이트)
      const initialTotal = medicineData.total || 0; // 총량이 없으면 0으로 시작
      const reserveResult = await this.machineService.reserveSlot(
        group.group_id, 
        mediId, 
        slotResult.slot!, 
        initialTotal
      );

      if (!reserveResult.success) {
        throw new BadRequestException(reserveResult.error || '슬롯 예약 실패');
      }

      assignedSlotNumber = slotResult.slot;
      console.log(`🔥 [MedicineService] 약물 슬롯 할당: ${mediId} → 슬롯 ${assignedSlotNumber}번 (총량: ${initialTotal})`);
      console.log(`🔥 [MedicineService] 총량은 나중에 스케줄 등록 시 업데이트됩니다.`);

      console.log(`🔥 [MedicineService] 약물 등록: ${mediId} - ${medicineData.name} (슬롯: ${assignedSlotNumber})`);

      return {
        success: true,
        data: {
          medi_id: savedMedicine.medi_id,
          name: savedMedicine.name,
          warning: savedMedicine.warning === 1,
          start_date: savedMedicine.start_date,
          end_date: savedMedicine.end_date,
          target_users: savedMedicine.target_users,
          slot: assignedSlotNumber,
          total: medicineData.total || 0,
        },
        message: '약물이 등록되었습니다.',
      };
    } catch (error) {
      console.error('🔥 [MedicineService] 약물 등록 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '약물 등록에 실패했습니다.',
      };
    }
  }

  /**
   * 4. 약물 수정
   */
  async updateMedicine(userId: string, mediId: string, updateData: {
    name?: string;
    start_date?: string;
    end_date?: string;
    target_users?: string[];
    total?: number;
  }) {
    try {
      const group = await this.getUserGroup(userId);
      
      const medicine = await this.medicineRepository.findOne({
        where: { 
          medi_id: mediId,
          group_id: group.group_id,
        },
      });

      if (!medicine) {
        throw new NotFoundException('약물을 찾을 수 없습니다.');
      }

      // 약물 정보 업데이트
      Object.assign(medicine, updateData);
      const updatedMedicine = await this.medicineRepository.save(medicine);

      // 총량 업데이트가 있으면 슬롯 정보도 업데이트
      if (updateData.total !== undefined) {
        const machine = await this.machineRepository.findOne({
          where: { group_id: group.group_id },
        });

        if (machine) {
          const slot = await this.machineSlotRepository.findOne({
            where: { 
              machine_id: machine.machine_id,
              medi_id: mediId,
            },
          });

          if (slot) {
            slot.total = updateData.total;
            slot.remain = updateData.total; // 새로 충전한 것으로 간주
            await this.machineSlotRepository.save(slot);
          }
        }
      }

      console.log(`🔥 [MedicineService] 약물 수정: ${mediId} - ${medicine.name}`);

      return {
        success: true,
        data: {
          medi_id: updatedMedicine.medi_id,
          name: updatedMedicine.name,
          warning: updatedMedicine.warning === 1,
          start_date: updatedMedicine.start_date,
          end_date: updatedMedicine.end_date,
          target_users: updatedMedicine.target_users,
        },
        message: '약물 정보가 수정되었습니다.',
      };
    } catch (error) {
      console.error('🔥 [MedicineService] 약물 수정 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '약물 수정에 실패했습니다.',
      };
    }
  }

  /**
   * 5. 약물 삭제 (연관 데이터 모두 삭제)
   */
  async deleteMedicine(userId: string, mediId: string) {
    try {
      const group = await this.getUserGroup(userId);
      
      const medicine = await this.medicineRepository.findOne({
        where: { 
          medi_id: mediId,
          group_id: group.group_id,
        },
      });

      if (!medicine) {
        throw new NotFoundException('약물을 찾을 수 없습니다.');
      }

      console.log(`🔥 [MedicineService] 약물 삭제 시작: ${mediId} - ${medicine.name}`);

      // 1️⃣ 스케줄 삭제 (Schedule 테이블)
      const deletedSchedules = await this.scheduleRepository.delete({
        medi_id: mediId,
        group_id: group.group_id,
      });
      console.log(`   ✅ 스케줄 삭제 완료: ${deletedSchedules.affected}개`);

      // 2️⃣ 복용 기록 삭제 (DoseHistory 테이블)
      const deletedHistory = await this.doseHistoryRepository.delete({
        medi_id: mediId,
        group_id: group.group_id,
      });
      console.log(`   ✅ 복용 기록 삭제 완료: ${deletedHistory.affected}개`);

      // 3️⃣ 슬롯 정보 삭제 (MachineSlot 테이블)
      const machine = await this.machineRepository.findOne({
        where: { group_id: group.group_id },
      });

      if (machine) {
        const deletedSlots = await this.machineSlotRepository.delete({
          machine_id: machine.machine_id,
          medi_id: mediId,
        });
        console.log(`   ✅ 슬롯 정보 삭제 완료: ${deletedSlots.affected}개`);
      }

      // 4️⃣ 약물 정보 삭제 (Medicine 테이블)
      await this.medicineRepository.remove(medicine);
      console.log(`   ✅ 약물 정보 삭제 완료`);

      console.log(`🎉 [MedicineService] 약물 삭제 완료: ${mediId} - ${medicine.name}`);

      return {
        success: true,
        data: { medi_id: mediId },
        message: '약물과 관련된 모든 정보가 삭제되었습니다.',
      };
    } catch (error) {
      console.error('🔥 [MedicineService] 약물 삭제 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '약물 삭제에 실패했습니다.',
      };
    }
  }

   /**
   * 6. 약물 검색 (이름 기반)
   */
  async searchMedicine(userId: string, query: string) {
    try {
      console.log(`[DEBUG] searchMedicine called for userId: ${userId}`); // userId 로깅
      const group = await this.getUserGroup(userId);
      console.log(`[DEBUG] User ${userId} belongs to group_id: ${group.group_id}`); // 사용자의 group_id 로깅

      // 그룹에 등록된 기기가 있는지 확인
      const machine = await this.machineRepository.findOne({
        where: { group_id: group.group_id },
      });

      if (!machine) {
        console.log(`[DEBUG] No machine found for group_id: ${group.group_id}`); // 기기를 찾지 못했을 경우 로깅
        throw new BadRequestException('디스펜서 등록이 필요합니다.');
      }
      console.log(`[DEBUG] Machine found for group_id: ${group.group_id}, machine_id: ${machine.machine_id}`); // 기기를 찾았을 경우 기기 상세 정보 로깅
      
      const medicines = await this.medicineRepository
        .createQueryBuilder('medicine')
        .where('medicine.group_id = :groupId', { groupId: group.group_id })
        .andWhere('medicine.name LIKE :query', { query: `%${query}%` })
        .orderBy('medicine.name', 'ASC')
        .getMany();

      console.log(`🔥 [MedicineService] 약물 검색: "${query}" - ${medicines.length}개 결과`);

      return {
        success: true,
        data: medicines.map(medicine => ({
          medi_id: medicine.medi_id,
          name: medicine.name,
          warning: medicine.warning === 1,
          start_date: medicine.start_date,
          end_date: medicine.end_date,
          target_users: medicine.target_users,
        })),
        message: `"${query}" 검색 결과입니다.`,
      };
    } catch (error) {
      console.error('🔥 [MedicineService] 약물 검색 오류:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        data: [],
        message: error.message || '약물 검색에 실패했습니다.',
      };
    }
  }


  /**
   * 7. 약물 재고 조회
   */
  async getMedicineInventory(userId: string) {
    try {
      const group = await this.getUserGroup(userId);
      
      const machine = await this.machineRepository.findOne({
        where: { group_id: group.group_id },
      });

      if (!machine) {
        return {
          success: true,
          data: [],
          message: '등록된 기기가 없습니다.',
        };
      }

      const slots = await this.machineSlotRepository.find({
        where: { machine_id: machine.machine_id },
        relations: ['medicine'],
      });

      const inventory = slots.map(slot => ({
        medi_id: slot.medi_id,
        name: slot.medicine?.name || '알 수 없는 약물',
        slot: slot.slot_number,
        total: slot.total,
        remain: slot.remain,
        warning: slot.remain <= 5, // 5개 이하면 경고
        percentage: slot.total > 0 ? Math.round((slot.remain / slot.total) * 100) : 0,
      }));

      console.log(`🔥 [MedicineService] 약물 재고 조회: ${inventory.length}개 슬롯`);

      return {
        success: true,
        data: inventory,
        message: '약물 재고를 조회했습니다.',
      };
    } catch (error) {
      console.error('🔥 [MedicineService] 약물 재고 조회 오류:', error);
      return {
        success: false,
        data: [],
        message: error.message || '약물 재고 조회에 실패했습니다.',
      };
    }
  }
} 