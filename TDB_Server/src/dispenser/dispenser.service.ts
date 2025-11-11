import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '../shared/entities/medicine.entity';
import { User } from '../users/entities/users.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Machine } from '../machine/entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { DoseHistory, DoseStatus } from '../dose-history/dose-history.entity';

@Injectable()
export class DispenserService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserGroup)
    private readonly userGroupRepository: Repository<UserGroup>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
    @InjectRepository(MachineSlot)
    private readonly machineSlotRepository: Repository<MachineSlot>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(DoseHistory)
    private readonly doseHistoryRepository: Repository<DoseHistory>,
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

  /**
   * 🔥 1. RFID 자동배출 - 메인 기능
   * RFID 태그 인식 시 자동으로 오늘의 스케줄에 따라 약 배출
   */
  async rfidAutoDispense(k_uid: string, machine_id: string) {
    try {
      console.log(`🔥 [DispenserService] RFID 자동배출 시작: k_uid=${k_uid}, machine_id=${machine_id}`);

      // 1. 사용자 확인
      const user = await this.userRepository.findOne({
        where: { k_uid },
      });

      if (!user) {
        throw new NotFoundException(`RFID UID(${k_uid})에 해당하는 사용자를 찾을 수 없습니다.`);
      }

      console.log(`✅ 사용자 확인: ${user.name} (${user.user_id})`);

      // 2. 기기 확인
      const machine = await this.machineRepository.findOne({
        where: { machine_id },
      });

      if (!machine) {
        throw new NotFoundException(`기기(${machine_id})를 찾을 수 없습니다.`);
      }

      // 3. 현재 시간대 판단 (아침/점심/저녁)
      const currentTimeOfDay = this.getCurrentTimeOfDay();
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentDayOfWeek = this.getCurrentDayOfWeek();

      console.log(`🕐 현재 시간대: ${currentTimeOfDay}, 요일: ${currentDayOfWeek}`);

      // 4. 오늘의 스케줄에서 현재 시간대에 맞는 약 조회
      const schedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.medicine', 'medicine')
        .leftJoinAndSelect('schedule.user', 'user')
        .where('schedule.user_id = :userId', { userId: user.user_id })
        .andWhere('schedule.day_of_week = :dayOfWeek', { dayOfWeek: currentDayOfWeek })
        .andWhere('schedule.time_of_day = :timeOfDay', { timeOfDay: currentTimeOfDay })
        .andWhere('schedule.dose > 0')
        .getMany();

      if (schedules.length === 0) {
        return {
          success: true,
          data: {
            user_id: user.user_id,
            user_name: user.name,
            time_of_day: currentTimeOfDay,
            dispensed_medicines: [],
            message: `${currentTimeOfDay === 'morning' ? '아침' : currentTimeOfDay === 'afternoon' ? '점심' : '저녁'} 시간대에 복용할 약이 없습니다.`,
          },
          message: '복용할 약이 없습니다.',
        };
      }

      console.log(`📋 ${currentTimeOfDay} 시간대 스케줄: ${schedules.length}개의 약`);

      // 5. 이미 복용했는지 확인
      const alreadyTaken = await this.doseHistoryRepository.findOne({
        where: {
          user_id: user.user_id,
          dose_date: new Date(todayStr),
          time_of_day: currentTimeOfDay,
          status: DoseStatus.COMPLETED,
        },
      });

      if (alreadyTaken) {
        return {
          success: false,
          data: null,
          message: `이미 ${currentTimeOfDay === 'morning' ? '아침' : currentTimeOfDay === 'afternoon' ? '점심' : '저녁'} 약을 복용하셨습니다.`,
        };
      }

      // 6. 각 약물 배출 실행
      const dispensedMedicines = [];
      const errors = [];

      for (const schedule of schedules) {
        try {
          // 슬롯 정보 조회
          const slot = await this.machineSlotRepository.findOne({
            where: {
              machine_id: machine_id,
              medi_id: schedule.medi_id,
            },
          });

          if (!slot) {
            errors.push(`${schedule.medicine?.name || schedule.medi_id}: 슬롯을 찾을 수 없습니다.`);
            continue;
          }

          if (slot.remain < schedule.dose) {
            errors.push(`${schedule.medicine?.name || schedule.medi_id}: 잔여량 부족 (필요: ${schedule.dose}, 남음: ${slot.remain})`);
            continue;
          }

          // 약물 배출 명령 전송
          console.log(`💊 배출 시작: ${schedule.medicine?.name} (슬롯 ${slot.slot_number}, ${schedule.dose}개)`);
          
          const dispenseResult = await this.sendDispenseCommand(
            machine_id,
            slot.slot_number,
            schedule.dose,
          );

          if (dispenseResult.success) {
            // 잔여량 차감
            slot.remain -= schedule.dose;
            await this.machineSlotRepository.save(slot);

            // 복용 기록 저장
            const doseHistory = this.doseHistoryRepository.create({
              group_id: machine.group_id,
              user_id: user.user_id,
              medi_id: schedule.medi_id,
              time_of_day: currentTimeOfDay,
              dose_date: new Date(todayStr),
              scheduled_dose: schedule.dose,
              actual_dose: schedule.dose,
              status: DoseStatus.COMPLETED,
              completed_at: new Date(),
              notes: `RFID 자동배출 (${k_uid})`,
            });

            await this.doseHistoryRepository.save(doseHistory);

            dispensedMedicines.push({
              medicine_name: schedule.medicine?.name || schedule.medi_id,
              slot_number: slot.slot_number,
              quantity: schedule.dose,
              remaining: slot.remain,
            });

            console.log(`✅ 배출 완료: ${schedule.medicine?.name} (${schedule.dose}개)`);
          } else {
            errors.push(`${schedule.medicine?.name || schedule.medi_id}: ${dispenseResult.error}`);
          }
        } catch (error) {
          errors.push(`${schedule.medicine?.name || schedule.medi_id}: ${error.message}`);
        }
      }

      // 7. 결과 반환
      const timeKorean = currentTimeOfDay === 'morning' ? '아침' : currentTimeOfDay === 'afternoon' ? '점심' : '저녁';
      
      return {
        success: dispensedMedicines.length > 0,
        data: {
          user_id: user.user_id,
          user_name: user.name,
          time_of_day: currentTimeOfDay,
          time_korean: timeKorean,
          dispensed_medicines: dispensedMedicines,
          total_dispensed: dispensedMedicines.length,
          errors: errors.length > 0 ? errors : null,
          timestamp: new Date().toISOString(),
        },
        message: dispensedMedicines.length > 0
          ? `${user.name}님의 ${timeKorean} 약 ${dispensedMedicines.length}개가 배출되었습니다.`
          : `약 배출에 실패했습니다: ${errors.join(', ')}`,
      };
    } catch (error) {
      console.error('🔥 [DispenserService] RFID 자동배출 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || 'RFID 자동배출에 실패했습니다.',
      };
    }
  }

  /**
   * 2. 스케줄 기반 수동배출 (앱에서 버튼 클릭 시)
   */
  async scheduleDispense(data: {
    machine_id: string;
    userId: string;
    medicineId: string;
    slot: number;
    quantity: number;
    reason?: string;
  }) {
    try {
      console.log(`🔥 [DispenserService] 스케줄 기반 자동배출 시작:`, data);

      // 1. 기기 정보 조회
      const machine = await this.machineRepository.findOne({
        where: { machine_id: data.machine_id },
      });

      if (!machine) {
        throw new NotFoundException('기기를 찾을 수 없습니다.');
      }

      // 2. 슬롯 정보 조회
      const slot = await this.machineSlotRepository.findOne({
        where: {
          machine_id: data.machine_id,
          slot_number: data.slot,
        },
        relations: ['medicine'],
      });

      if (!slot) {
        throw new NotFoundException('슬롯을 찾을 수 없습니다.');
      }

      if (slot.remain < data.quantity) {
        throw new BadRequestException('슬롯의 잔여량이 부족합니다.');
      }

      // 3. 라즈베리파이로 디스펜스 명령 전송
      const dispenseResult = await this.sendDispenseCommand(data.machine_id, data.slot, data.quantity);

      if (dispenseResult.success) {
        // 수량 차감
        slot.remain -= data.quantity;
        await this.machineSlotRepository.save(slot);

        // 복용 기록 저장
        const doseHistory = this.doseHistoryRepository.create({
          group_id: machine.group_id,
          user_id: data.userId,
          medi_id: data.medicineId,
          time_of_day: this.getCurrentTimeOfDay(),
          dose_date: new Date(),
          scheduled_dose: data.quantity,
          actual_dose: data.quantity,
          status: DoseStatus.COMPLETED,
          completed_at: new Date(),
          notes: `스케줄 기반 자동배출: ${data.reason || 'RFID 인식'}`,
        });

        await this.doseHistoryRepository.save(doseHistory);

        console.log(`🔥 [DispenserService] 스케줄 기반 자동배출 완료: ${data.quantity}개 배출`);

        return {
          success: true,
          data: {
            dispensed_quantity: data.quantity,
            remaining_quantity: slot.remain,
            dispense_id: `schedule_${Date.now()}`,
            timestamp: new Date().toISOString(),
          },
          message: '스케줄 기반 자동배출이 완료되었습니다.',
        };
      } else {
        throw new BadRequestException(`디스펜스 실패: ${dispenseResult.error}`);
      }
    } catch (error) {
      console.error('🔥 [DispenserService] 스케줄 기반 자동배출 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '스케줄 기반 자동배출에 실패했습니다.',
      };
    }
  }

  /**
   * 3. 기기 상태 조회
   */
  async getMachineStatus(machine_id: string) {
    try {
      const machine = await this.machineRepository.findOne({
        where: { machine_id: machine_id },
      });

      if (!machine) {
        throw new NotFoundException('기기를 찾을 수 없습니다.');
      }

      const slots = await this.machineSlotRepository.find({
        where: { machine_id: machine_id },
        relations: ['medicine'],
      });

      const slotStatus = slots.map(slot => ({
        slot_number: slot.slot_number,
        medi_id: slot.medi_id,
        medicine_name: slot.medicine?.name || '알 수 없는 약물',
        total: slot.total,
        remain: slot.remain,
        percentage: slot.total > 0 ? Math.round((slot.remain / slot.total) * 100) : 0,
        warning: slot.remain <= 5,
      }));

      console.log(`🔥 [DispenserService] 기기 상태 조회: ${machine_id} - ${slots.length}개 슬롯`);

      return {
        success: true,
        data: {
          machine_id: machine.machine_id,
          group_id: machine.group_id,
          max_slot: machine.max_slot,
          error_status: machine.error_status,
          last_error_at: machine.last_error_at,
          slots: slotStatus,
          total_slots: slots.length,
          online: true, // TODO: 실제 통신 상태 확인
        },
        message: '기기 상태를 조회했습니다.',
      };
    } catch (error) {
      console.error('🔥 [DispenserService] 기기 상태 조회 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '기기 상태 조회에 실패했습니다.',
      };
    }
  }

  /**
   * 4. UID 확인 (RFID 기반)
   */
  async verifyUid(uid: string) {
    try {
      // 사용자 UID 확인
      const user = await this.userRepository.findOne({
        where: { k_uid: uid },
      });

      if (user) {
        console.log(`🔥 [DispenserService] 사용자 UID 확인: ${uid} - ${user.name}`);
        
        return {
          success: true,
          data: {
            type: 'user',
            user_id: user.user_id,
            name: user.name,
            age: user.age,
            uid: uid,
          },
          message: '사용자가 확인되었습니다.',
        };
      }

      // 기기 UID 확인 (TODO: 기기 UID 필드 추가 필요)
      const machine = await this.machineRepository.findOne({
        where: { machine_id: uid }, // 임시로 machine_id로 확인
      });

      if (machine) {
        console.log(`🔥 [DispenserService] 기기 UID 확인: ${uid}`);
        
        return {
          success: true,
          data: {
            type: 'machine',
            machine_id: machine.machine_id,
            group_id: machine.group_id,
            uid: uid,
          },
          message: '기기가 확인되었습니다.',
        };
      }

      throw new NotFoundException('UID를 찾을 수 없습니다.');
    } catch (error) {
      console.error('🔥 [DispenserService] UID 확인 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || 'UID 확인에 실패했습니다.',
      };
    }
  }

  /**
   * 5. 오늘의 디스펜스 목록 조회
   */
  async getDispenseList(machine_id?: string, userId?: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let queryBuilder = this.scheduleRepository.createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.medicine', 'medicine')
        .leftJoinAndSelect('schedule.user', 'user')
        .where('schedule.day_of_week = :dayOfWeek', { 
          dayOfWeek: this.getCurrentDayOfWeek() 
        });

      if (machine_id) {
        // 기기별 스케줄 조회
        queryBuilder.innerJoin('machine', 'm', 'm.group_id = schedule.group_id')
          .andWhere('m.machine_id = :machine_id', { machine_id });
      }

      if (userId) {
        // 특정 사용자 스케줄 조회
        queryBuilder.andWhere('schedule.user_id = :userId', { userId });
      }

      const schedules = await queryBuilder.getMany();

      // 복용 완료 여부 확인
      const dispenseList = await Promise.all(schedules.map(async (schedule) => {
                 const completed = await this.doseHistoryRepository.findOne({
           where: {
             user_id: schedule.user_id,
             medi_id: schedule.medi_id,
             dose_date: new Date(today),
             time_of_day: schedule.time_of_day,
             status: DoseStatus.COMPLETED,
           },
         });

        return {
          schedule_id: schedule.schedule_id,
          user_id: schedule.user_id,
          user_name: schedule.user?.name || '알 수 없는 사용자',
          medi_id: schedule.medi_id,
          medicine_name: schedule.medicine?.name || '알 수 없는 약물',
          time_of_day: schedule.time_of_day,
          dose: schedule.dose,
          completed: !!completed,
          completed_at: completed?.completed_at || null,
        };
      }));

      console.log(`🔥 [DispenserService] 오늘의 디스펜스 목록 조회: ${dispenseList.length}개`);

      return {
        success: true,
        data: {
          date: today,
          schedules: dispenseList,
          total_count: dispenseList.length,
          completed_count: dispenseList.filter(item => item.completed).length,
        },
        message: '오늘의 디스펜스 목록을 조회했습니다.',
      };
    } catch (error) {
      console.error('🔥 [DispenserService] 디스펜스 목록 조회 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '디스펜스 목록 조회에 실패했습니다.',
      };
    }
  }

  /**
   * 6. 슬롯 상태 조회
   */
  async getSlotStatus(machine_id?: string) {
    try {
      let queryBuilder = this.machineSlotRepository.createQueryBuilder('slot')
        .leftJoinAndSelect('slot.medicine', 'medicine');

      if (machine_id) {
        queryBuilder.where('slot.machine_id = :machine_id', { machine_id });
      }

      const slots = await queryBuilder.getMany();

      const slotStatus = slots.map(slot => ({
        machine_id: slot.machine_id,
        slot_number: slot.slot_number,
        medi_id: slot.medi_id,
        medicine_name: slot.medicine?.name || '비어있음',
        total: slot.total,
        remain: slot.remain,
        percentage: slot.total > 0 ? Math.round((slot.remain / slot.total) * 100) : 0,
        low_stock: slot.remain <= 5,
        empty: slot.remain === 0,
      }));

      console.log(`🔥 [DispenserService] 슬롯 상태 조회: ${slots.length}개 슬롯`);

      return {
        success: true,
        data: {
          slots: slotStatus,
          total_slots: slots.length,
          low_stock_count: slotStatus.filter(slot => slot.low_stock).length,
          empty_count: slotStatus.filter(slot => slot.empty).length,
        },
        message: '슬롯 상태를 조회했습니다.',
      };
    } catch (error) {
      console.error('🔥 [DispenserService] 슬롯 상태 조회 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '슬롯 상태 조회에 실패했습니다.',
      };
    }
  }

  /**
   * 7. 슬롯 충돌 디버깅 - 모든 슬롯 정보 상세 조회
   */
  async debugAllSlots(machine_id: string) {
    try {
      const machine = await this.machineRepository.findOne({
        where: { machine_id: machine_id },
      });

      if (!machine) {
        throw new NotFoundException('기기를 찾을 수 없습니다.');
      }

      // 모든 슬롯 정보 조회 (Medicine 정보도 함께)
      const slots = await this.machineSlotRepository.find({
        where: { machine_id: machine_id },
        relations: ['medicine'],
        order: { slot_number: 'ASC' }
      });

      // 상세 슬롯 정보 구성
      const detailedSlots = slots.map(slot => ({
        machine_id: slot.machine_id,
        slot_number: slot.slot_number,
        medi_id: slot.medi_id,
        medicine_name: slot.medicine?.name || 'Medicine 테이블에서 찾을 수 없음',
        total: slot.total,
        remain: slot.remain,
        // 의약품/영양제 구분
        item_type: slot.medi_id?.startsWith('medicine_') ? '의약품' : 
                  slot.medi_id?.startsWith('supplement_') ? '영양제' : 
                  /^\d+$/.test(slot.medi_id || '') ? '외부API 의약품' : '알 수 없음',
        medicine_info: slot.medicine ? {
          group_id: slot.medicine.group_id,
          warning: slot.medicine.warning,
          start_date: slot.medicine.start_date,
          end_date: slot.medicine.end_date,
          target_users: slot.medicine.target_users,
          listed_only: slot.medicine.listed_only
        } : null
      }));

      // 슬롯 중복 검사
      const slotNumbers = slots.map(slot => slot.slot_number);
      const duplicateSlots = slotNumbers.filter((slot, index) => slotNumbers.indexOf(slot) !== index);
      
      console.log(`🔥 [DispenserService] 슬롯 디버깅: ${machine_id}`);
      console.log(`🔥 총 슬롯 수: ${slots.length}개`);
      console.log(`🔥 중복 슬롯: ${duplicateSlots.length > 0 ? duplicateSlots.join(', ') : '없음'}`);
      
      detailedSlots.forEach((slot, idx) => {
        console.log(`🔥 슬롯 ${idx + 1}: ${slot.slot_number}번 - ${slot.item_type} - ${slot.medicine_name} (${slot.medi_id})`);
      });

      return {
        success: true,
        data: {
          machine_id: machine.machine_id,
          group_id: machine.group_id,
          max_slot: machine.max_slot,
          total_registered_slots: slots.length,
          duplicate_slots: duplicateSlots,
          slots: detailedSlots,
          summary: {
            medicines: detailedSlots.filter(slot => slot.item_type === '의약품').length,
            supplements: detailedSlots.filter(slot => slot.item_type === '영양제').length,
            external_medicines: detailedSlots.filter(slot => slot.item_type === '외부API 의약품').length,
            unknown: detailedSlots.filter(slot => slot.item_type === '알 수 없음').length
          }
        },
        message: `슬롯 디버깅 정보를 조회했습니다. (총 ${slots.length}개 슬롯)`,
      };
    } catch (error) {
      console.error('🔥 [DispenserService] 슬롯 디버깅 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '슬롯 디버깅에 실패했습니다.',
      };
    }
  }

  // 🔥 전체 데이터베이스 상태 디버깅
  async debugDatabaseState(machine_id: string) {
    try {
      console.log(`🔍 [DispenserService] 데이터베이스 상태 디버깅: ${machine_id}`);

      // 1. Machine 정보 조회
      const machine = await this.machineRepository.findOne({
        where: { machine_id: machine_id },
      });

      // 2. 해당 그룹의 모든 Medicine 조회
      const medicines = await this.medicineRepository.find({
        where: { group_id: machine?.group_id },
        order: { medi_id: 'ASC' }
      });

      // 3. machine_slot 테이블의 모든 슬롯 조회
      const slots = await this.machineSlotRepository.find({
        where: { machine_id: machine_id },
        order: { slot_number: 'ASC' }
      });

      // 4. 데이터 비교 분석
      const medicineIds = medicines.map(m => m.medi_id);
      const slotMedicineIds = slots.map(s => s.medi_id);

      // 5. 불일치 분석
      const orphanMedicines = medicineIds.filter(id => !slotMedicineIds.includes(id));
      const orphanSlots = slotMedicineIds.filter(id => !medicineIds.includes(id));

      console.log(`🔥 [데이터베이스 분석]`);
      console.log(`  Machine: ${machine_id} (그룹: ${machine?.group_id})`);
      console.log(`  Medicine 테이블: ${medicines.length}개`);
      console.log(`  machine_slot 테이블: ${slots.length}개`);
      console.log(`  고아 Medicine (슬롯 없음): ${orphanMedicines.length}개 - [${orphanMedicines.join(', ')}]`);
      console.log(`  고아 슬롯 (Medicine 없음): ${orphanSlots.length}개 - [${orphanSlots.join(', ')}]`);

      // 6. 상세 정보 출력
      console.log(`\n🔥 [Medicine 테이블 상세]`);
      medicines.forEach((med, idx) => {
        console.log(`  ${idx + 1}. ${med.medi_id} - ${med.name} (그룹: ${med.group_id})`);
      });

      console.log(`\n🔥 [machine_slot 테이블 상세]`);
      slots.forEach((slot, idx) => {
        console.log(`  ${idx + 1}. 슬롯 ${slot.slot_number}: ${slot.medi_id} (${slot.total}/${slot.remain})`);
      });

      return {
        success: true,
        data: {
          machine_info: {
            machine_id: machine?.machine_id,
            group_id: machine?.group_id,
            max_slot: machine?.max_slot
          },
          medicine_table: {
            count: medicines.length,
            items: medicines.map(m => ({
              medi_id: m.medi_id,
              name: m.name,
              group_id: m.group_id,
              target_users: m.target_users,
              end_date: m.end_date,
              listed_only: m.listed_only
            }))
          },
          machine_slot_table: {
            count: slots.length,
            items: slots.map(s => ({
              slot_number: s.slot_number,
              medi_id: s.medi_id,
              total: s.total,
              remain: s.remain
            }))
          },
          inconsistencies: {
            orphan_medicines: orphanMedicines,
            orphan_slots: orphanSlots,
            total_issues: orphanMedicines.length + orphanSlots.length
          }
        },
        message: `데이터베이스 상태 분석 완료. ${orphanMedicines.length + orphanSlots.length}개의 불일치 발견.`,
      };
    } catch (error) {
      console.error('🔥 [DispenserService] 데이터베이스 디버깅 오류:', error);
      return {
        success: false,
        data: null,
        message: error.message || '데이터베이스 디버깅에 실패했습니다.',
      };
    }
  }

  // 헬퍼 메서드들
  private async sendDispenseCommand(machine_id: string, slot: number, quantity: number): Promise<{success: boolean, error?: string}> {
    try {
      // TODO: 실제 라즈베리파이 통신 구현
      console.log(`🔥 [DispenserService] 라즈베리파이로 디스펜스 명령 전송: ${machine_id} - 슬롯 ${slot}, 수량 ${quantity}`);
      
      // 임시로 성공 반환 (실제로는 HTTP/TCP 통신)
      await new Promise(resolve => setTimeout(resolve, 100)); // 통신 지연 시뮬레이션
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `디스펜스 명령 전송 실패: ${error.message}` 
      };
    }
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  private getCurrentDayOfWeek(): string {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[new Date().getDay()];
  }
} 