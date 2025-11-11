import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule, DayOfWeek, TimeOfDay } from './entities/schedule.entity';
import { DoseHistory, DoseStatus } from '../dose-history/dose-history.entity';
import { Medicine } from '../shared/entities/medicine.entity';
import { User } from '../users/entities/users.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Machine } from '../machine/entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { DoseHistoryService } from '../dose-history/dose-history.service';
import { AgeValidationService } from '../validation/age-validation.service';
import { randomUUID } from 'crypto';

interface AgeValidationResult {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(DoseHistory)
    private readonly doseHistoryRepo: Repository<DoseHistory>,
    @InjectRepository(Medicine)
    private readonly medicineRepo: Repository<Medicine>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserGroup)
    private readonly userGroupRepo: Repository<UserGroup>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepo: Repository<UserGroupMembership>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
    @InjectRepository(MachineSlot)
    private readonly machineSlotRepo: Repository<MachineSlot>,
    private readonly doseHistoryService: DoseHistoryService,
    private readonly ageValidationService: AgeValidationService,
  ) {}

  // 사용자의 그룹 정보 조회 헬퍼 메서드
  private async getUserGroup(userId: string): Promise<{ user: User; group: UserGroup; membership: UserGroupMembership }> {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const membership = await this.membershipRepo.findOne({
      where: { user_id: userId },
      relations: ['group']
    });

    if (!membership) {
      throw new NotFoundException('사용자의 그룹 정보를 찾을 수 없습니다.');
    }

    return { user, group: membership.group, membership };
  }

  // 매트릭스 스케줄 저장 (새로운 그룹 기반)
  async saveMatrixSchedule(
    medicineId: string,
    memberId: string,
    scheduleItems: Array<{
      day_of_week: string;
      time_of_day: string;
      dose_count: number;
      enabled: boolean;
    }>,
    totalQuantity: string = '1',
    requestUserId?: string
  ) {
    try {
      console.log(`🔥 [ScheduleService] 매트릭스 스케줄 저장 시작: ${medicineId}/${memberId}`);

      // 1. 사용자 그룹 정보 조회
      const { user, group, membership } = await this.getUserGroup(memberId);
      
      // 2. 요청자 그룹 정보 조회 (권한 확인용)
      let requestMembership: UserGroupMembership | null = null;
      if (requestUserId && requestUserId !== memberId) {
        requestMembership = await this.membershipRepo.findOne({
          where: { user_id: requestUserId },
          relations: ['user']
        });
      }

      // 3. 약물 정보 조회 (그룹 기반)
      const medicine = await this.medicineRepo.findOne({
        where: { medi_id: medicineId, group_id: group.group_id }
      });

      if (!medicine) {
        throw new NotFoundException('약물 정보를 찾을 수 없습니다.');
      }

      // 4. 기존 스케줄 조회 (삭제 전에 어떤 시간대가 있었는지 파악)
      const oldSchedules = await this.scheduleRepo.find({
        where: {
          medi_id: medicineId,
          user_id: memberId,
          group_id: group.group_id
        }
      });

      // 5. 기존 스케줄 삭제
      await this.scheduleRepo.delete({
        medi_id: medicineId,
        user_id: memberId,
        group_id: group.group_id
      });

      // 6. 새로운 스케줄 생성
      const newSchedules = scheduleItems
        .filter(item => item.enabled)
        .map(item => {
          return this.scheduleRepo.create({
            schedule_id: randomUUID(),
            group_id: group.group_id,
            medi_id: medicineId,
            user_id: memberId,
            day_of_week: item.day_of_week as DayOfWeek,
            time_of_day: item.time_of_day as TimeOfDay,
            dose: item.dose_count,
            created_at: new Date(),
          });
        });

      const savedSchedules = await this.scheduleRepo.save(newSchedules);
      console.log(`🔥 [ScheduleService] ${savedSchedules.length}개 스케줄 저장 완료`);

      // 🔥 7. 오늘 날짜의 불필요한 복용 기록 정리
      // 새 스케줄에서 제거된 시간대의 복용 기록을 삭제
      const today = new Date().toISOString().split('T')[0];
      const currentDayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
      
      // 기존 스케줄 중 오늘 요일의 시간대 목록
      const oldTimeSlotsForToday = oldSchedules
        .filter(s => s.day_of_week === currentDayOfWeek)
        .map(s => s.time_of_day);
      
      // 새 스케줄 중 오늘 요일의 시간대 목록
      const newTimeSlotsForToday = savedSchedules
        .filter(s => s.day_of_week === currentDayOfWeek)
        .map(s => s.time_of_day);
      
      // 제거된 시간대 파악 (기존에는 있었지만 새로 저장된 스케줄에는 없는 시간대)
      const removedTimeSlots = oldTimeSlotsForToday.filter(
        timeSlot => !newTimeSlotsForToday.includes(timeSlot)
      );
      
      // 제거된 시간대의 오늘 복용 기록 삭제
      if (removedTimeSlots.length > 0) {
        console.log(`🔥 [ScheduleService] 오늘(${currentDayOfWeek}) 제거된 시간대의 복용 기록 삭제:`, {
          medicineId,
          memberId,
          today,
          removedTimeSlots
        });
        
        for (const timeSlot of removedTimeSlots) {
          await this.doseHistoryRepo.delete({
            medi_id: medicineId,
            user_id: memberId,
            dose_date: today as any,
            time_of_day: timeSlot
          });
        }
        
        console.log(`✅ [ScheduleService] ${removedTimeSlots.length}개 시간대의 복용 기록 삭제 완료`);
      }

      // 6. MachineSlot 업데이트 (totalQuantity가 있는 경우)
      await this.updateMachineSlotQuantity(group.group_id, medicineId, totalQuantity, requestMembership);

      return {
        success: true,
        message: '매트릭스 스케줄이 성공적으로 저장되었습니다.',
        data: {
          savedCount: savedSchedules.length,
          schedules: savedSchedules,
        }
      };

    } catch (error) {
      console.error('🔥 [ScheduleService] 매트릭스 스케줄 저장 실패:', error);
      throw error;
    }
  }

  // MachineSlot 수량 업데이트 헬퍼 메서드
  private async updateMachineSlotQuantity(
    groupId: string, 
    mediId: string, 
    totalQuantity: string, 
    requestMembership?: UserGroupMembership | null
  ) {
    // totalQuantity 파싱
    let parsedQuantity = 0;
    if (totalQuantity && totalQuantity.trim() !== '') {
      const cleanedQuantity = totalQuantity.replace(/[#]/g, '');
      parsedQuantity = Number(cleanedQuantity);
    }

    if (parsedQuantity <= 0) {
      console.log(`[ScheduleService] totalQuantity가 유효하지 않음: ${totalQuantity}`);
      return;
    }

    // 권한 확인 (부모만 수량 업데이트 가능)
    if (requestMembership && requestMembership.role !== UserRole.PARENT) {
      console.log(`[ScheduleService] 권한 없음: ${requestMembership.role} (부모만 수량 설정 가능)`);
      return;
    }

    try {
      // 해당 그룹의 기계들 조회
      const machines = await this.machineRepo.find({
        where: { group_id: groupId }
      });

      if (machines.length === 0) {
        console.log(`[ScheduleService] 그룹 ${groupId}에 등록된 기계가 없음`);
        return;
      }

      // 각 기계에서 해당 약물의 슬롯 찾기
      for (const machine of machines) {
        const machineSlot = await this.machineSlotRepo.findOne({
          where: { machine_id: machine.machine_id, medi_id: mediId }
        });

        if (machineSlot) {
          // 기존 슬롯 업데이트
          machineSlot.total = parsedQuantity;
          machineSlot.remain = parsedQuantity;
          await this.machineSlotRepo.save(machineSlot);
          console.log(`[ScheduleService] 슬롯 업데이트: ${machine.machine_id} - ${mediId}, total=${parsedQuantity}`);
          break; // 첫 번째 슬롯만 업데이트
        }
      }

    } catch (error) {
      console.error('[ScheduleService] MachineSlot 업데이트 오류:', error);
    }
  }

  // 기본 스케줄 저장
  async saveSchedule(
    medicineId: string,
    memberId: string,
    scheduleData: any,
    totalQuantity?: string,
    doseCount?: string,
    requestUserId?: string,
  ) {
    console.log('[ScheduleService] 스케줄 저장:', { medicineId, memberId, scheduleData, totalQuantity });

    // 나이 유효성 검사
    const validationResult = await this.validateUserAge(memberId, medicineId);
    if (!validationResult.allowed) {
      throw new BadRequestException({
        error: 'AGE_RESTRICTION',
        message: validationResult.reason,
        warnings: validationResult.warnings
      });
    }

    // 배열 형태 스케줄 데이터 처리
    if (Array.isArray(scheduleData)) {
      return this.saveMatrixSchedule(medicineId, memberId, scheduleData, totalQuantity, requestUserId);
    }

    // 객체 형태 스케줄 데이터 처리
    const { user, group } = await this.getUserGroup(memberId);

    const medicine = await this.medicineRepo.findOne({
      where: { medi_id: medicineId, group_id: group.group_id }
    });

    if (!medicine) {
      throw new NotFoundException('약물 정보를 찾을 수 없습니다.');
    }

    // 기존 스케줄 삭제
    await this.scheduleRepo.delete({
      user_id: memberId,
      medi_id: medicineId,
      group_id: group.group_id
    });

    // 새 스케줄 생성
    const schedule = this.scheduleRepo.create({
      schedule_id: randomUUID(),
      group_id: group.group_id,
      medi_id: medicineId,
      user_id: memberId,
      day_of_week: scheduleData.day_of_week,
      time_of_day: scheduleData.time_of_day,
      dose: scheduleData.dose || 1,
      created_at: new Date(),
    });

    const savedSchedule = await this.scheduleRepo.save(schedule);

    // MachineSlot 업데이트
    if (totalQuantity) {
      const requestMembership = requestUserId ? await this.membershipRepo.findOne({
        where: { user_id: requestUserId }
      }) : null;
      
      await this.updateMachineSlotQuantity(group.group_id, medicineId, totalQuantity, requestMembership);
    }

    return {
      success: true,
      message: '스케줄이 저장되었습니다.',
      data: savedSchedule
    };
  }

  // 타임도스 저장 (시간대별 용량 설정)
  async saveScheduleWithTimeDoses(
    medicineId: string,
    memberId: string,
    scheduleData: any,
    totalQuantity?: string,
    doseCount?: string,
    requestUserId?: string,
    timeDoses?: {
      morningDose?: number;
      afternoonDose?: number;
      eveningDose?: number;
    }
  ) {
    console.log('[ScheduleService] 타임도스 스케줄 저장:', { medicineId, memberId, timeDoses });

    const { user, group } = await this.getUserGroup(memberId);

    const medicine = await this.medicineRepo.findOne({
      where: { medi_id: medicineId, group_id: group.group_id }
    });

    if (!medicine) {
      throw new NotFoundException('약물 정보를 찾을 수 없습니다.');
    }

    // 기존 스케줄 삭제
    await this.scheduleRepo.delete({
      user_id: memberId,
      medi_id: medicineId,
      group_id: group.group_id
    });

    // 타임도스 스케줄 생성
    const newSchedules = [];
    
    if (timeDoses?.morningDose && timeDoses.morningDose > 0) {
      const schedule = this.scheduleRepo.create({
        schedule_id: randomUUID(),
        group_id: group.group_id,
        medi_id: medicineId,
        user_id: memberId,
        day_of_week: scheduleData.day_of_week || 'daily',
        time_of_day: 'morning',
        dose: timeDoses.morningDose,
        created_at: new Date(),
      });
      newSchedules.push(schedule);
    }

    if (timeDoses?.afternoonDose && timeDoses.afternoonDose > 0) {
      const schedule = this.scheduleRepo.create({
        schedule_id: randomUUID(),
        group_id: group.group_id,
        medi_id: medicineId,
        user_id: memberId,
        day_of_week: scheduleData.day_of_week || 'daily',
        time_of_day: 'afternoon',
        dose: timeDoses.afternoonDose,
        created_at: new Date(),
      });
      newSchedules.push(schedule);
    }

    if (timeDoses?.eveningDose && timeDoses.eveningDose > 0) {
      const schedule = this.scheduleRepo.create({
        schedule_id: randomUUID(),
        group_id: group.group_id,
        medi_id: medicineId,
        user_id: memberId,
        day_of_week: scheduleData.day_of_week || 'daily',
        time_of_day: 'evening',
        dose: timeDoses.eveningDose,
        created_at: new Date(),
      });
      newSchedules.push(schedule);
    }

    const savedSchedules = await this.scheduleRepo.save(newSchedules);

    // MachineSlot 업데이트
    if (totalQuantity) {
      const requestMembership = requestUserId ? await this.membershipRepo.findOne({
        where: { user_id: requestUserId }
      }) : null;
      
      await this.updateMachineSlotQuantity(group.group_id, medicineId, totalQuantity, requestMembership);
    }

    return {
      success: true,
      message: '타임도스 스케줄이 저장되었습니다.',
      data: savedSchedules
    };
  }

  // 스케줄 조회
  async getSchedule(medicineId: string, memberId: string) {
    const { user, group } = await this.getUserGroup(memberId);

    console.log(`[ScheduleService] 스케줄 조회: ${medicineId}/${memberId}, group: ${group.group_id}`);
    console.log(`[DEBUG] getSchedule - User ${memberId} belongs to group_id: ${group.group_id}`); // Log user's group_id
    console.log(`[DEBUG] getSchedule - Querying for medicineId: ${medicineId}`); // Log medicineId

    // 스케줄 조회
    const schedules = await this.scheduleRepo.find({
      where: {
        user_id: memberId,
        medi_id: medicineId,
        group_id: group.group_id
      }
    });

    // MachineSlot 정보 조회
    const machineSlots = await this.machineSlotRepo
      .createQueryBuilder('slot')
      .innerJoinAndSelect('slot.machine', 'machine') // Changed to innerJoinAndSelect
      .where('machine.group_id = :group_id', { group_id: group.group_id })
      .andWhere('slot.medi_id = :medi_id', { medi_id: medicineId })
      .getMany();

    console.log(`[DEBUG] getSchedule - MachineSlots query result length: ${machineSlots.length}`); // Log machineSlots length
    if (machineSlots.length > 0) {
      // Removed the problematic log line, as machine.machine_id should now be accessible
      console.log(`[DEBUG] getSchedule - Found MachineSlot for machine_id: ${machineSlots[0].machine.machine_id}, group_id: ${machineSlots[0].machine.group_id}`);
    }

    const slotInfo = machineSlots.length > 0 ? machineSlots[0] : null;

    return {
      success: true,
      data: {
        schedules,
        slotInfo: slotInfo ? {
          slot_number: slotInfo.slot_number,
          total: slotInfo.total,
          remain: slotInfo.remain
        } : null
      }
    };
  }

  // 복용 완료 처리
  async completeDose(
    medicineId: string,
    userId: string,
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    actualDose?: number,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.doseHistoryService.completeDose(
        userId,
        medicineId,
        timeOfDay,
        actualDose || 1,
        notes
      );

      return {
        success: true,
        message: '복용이 완료되었습니다.'
      };
    } catch (error) {
      console.error('복용 완료 처리 오류:', error);
      return {
        success: false,
        message: '복용 완료 처리에 실패했습니다.'
      };
    }
  }

  // 복용 기록 조회
  async getDoseHistory(
    medicineId: string,
    userId: string,
    date?: string
  ): Promise<any[]> {
    return this.doseHistoryService.getDoseHistory(userId, medicineId, date, date);
  }

  // 주간 통계
  async getWeeklyStats(userId: string, medicineId?: string): Promise<{
    totalScheduled: number;
    totalCompleted: number;
    completionRate: number;
    dailyStats: any[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    
    const stats = await this.doseHistoryService.getWeeklyStats(userId, startDate.toISOString().split('T')[0]);
    
    return {
      totalScheduled: stats.total_scheduled,
      totalCompleted: stats.total_completed,
      completionRate: stats.completion_rate,
      dailyStats: stats.daily_stats
    };
  }

  // 오늘의 스케줄 (그룹 기반)
  async getTodaySchedule(groupId: string) {
    const today = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[today.getDay()];

    const schedules = await this.scheduleRepo.find({
      where: { 
        group_id: groupId,
        day_of_week: dayOfWeek as DayOfWeek
      },
      relations: ['medicine', 'user']
    });

    return schedules.map(schedule => ({
      schedule_id: schedule.schedule_id,
      user_id: schedule.user_id,
      user_name: schedule.user?.name,
      medi_id: schedule.medi_id,
      medicine_name: schedule.medicine?.name,
      time_of_day: schedule.time_of_day,
      dose: schedule.dose
    }));
  }

  // 가족 요약 (그룹 기반)
  async getFamilySummary(groupId: string) {
    const children = await this.membershipRepo.find({
      where: { group_id: groupId, role: UserRole.CHILD },
      relations: ['user']
    });

    return children.map(membership => ({
      memberId: membership.user_id,
      memberName: membership.user.name,
      activeMedicines: 0, // 별도 계산 로직 필요
      todayCompleted: 0,
      todayTotal: 0,
      upcomingRefills: 0,
    }));
  }

  // 현재 복용량 조회
  async getCurrentDose(medicineId: string, userId: string): Promise<{ 
    dose: number; 
    timeSlot: string; 
    nextDose?: { timeSlot: string; dose: number } 
  }> {
    const currentHour = new Date().getHours();
    let timeSlot = 'morning';
    
    if (currentHour >= 12 && currentHour < 18) {
      timeSlot = 'afternoon';
    } else if (currentHour >= 18) {
      timeSlot = 'evening';
    }

    const { group } = await this.getUserGroup(userId);

    const schedule = await this.scheduleRepo.findOne({
      where: {
        user_id: userId,
        medi_id: medicineId,
        group_id: group.group_id,
        time_of_day: timeSlot as TimeOfDay
      }
    });

    return {
      dose: schedule?.dose || 1,
      timeSlot,
    };
  }

  // 일일 스케줄 조회
  async getDailySchedule(medicineId: string, userId: string, date?: string): Promise<{
    morning: number;
    afternoon: number;  
    evening: number;
    total: number;
  }> {
    const { group } = await this.getUserGroup(userId);

    const schedules = await this.scheduleRepo.find({
      where: {
        user_id: userId,
        medi_id: medicineId,
        group_id: group.group_id
      }
    });

    const result = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      total: 0
    };

    schedules.forEach(schedule => {
      result[schedule.time_of_day] = schedule.dose;
      result.total += schedule.dose;
    });

    return result;
  }

  // 사용자 나이 유효성 검사
  private async validateUserAge(userId: string, medicineId: string): Promise<AgeValidationResult> {
    try {
      // 사용자 정보 조회
      const user = await this.userRepo.findOne({ where: { user_id: userId } });
      if (!user) {
        return {
          allowed: false,
          reason: '사용자를 찾을 수 없습니다.',
          warnings: []
        };
      }

      // 약물 정보 조회
      const { group } = await this.getUserGroup(userId);
      const medicine = await this.medicineRepo.findOne({
        where: { medi_id: medicineId, group_id: group.group_id }
      });

      if (!medicine) {
        return {
          allowed: false,
          reason: '약물 정보를 찾을 수 없습니다.',
          warnings: []
        };
      }

      // 나이 계산
      const currentYear = new Date().getFullYear();
      const birthYear = user.birthDate ? new Date(user.birthDate).getFullYear() : currentYear - user.age;
      const userAge = currentYear - birthYear;

      // AgeValidationService를 통한 검증
      const result = this.ageValidationService.validateAge(userAge, String(medicine.warning || ''));
      
      return {
        allowed: result.allowed,
        reason: result.reason,
        warnings: result.warnings
      };
    } catch (error) {
      console.error('나이 유효성 검사 오류:', error);
      return {
        allowed: true, // 기본적으로 허용
        warnings: ['나이 유효성 검사 중 오류가 발생했습니다.']
      };
    }
  }
} 