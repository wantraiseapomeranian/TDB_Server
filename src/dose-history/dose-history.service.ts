import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoseHistory, DoseStatus } from './dose-history.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Medicine } from '../shared/entities/medicine.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DoseHistoryService {
  constructor(
    @InjectRepository(DoseHistory)
    private readonly doseHistoryRepository: Repository<DoseHistory>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,
  ) {}

  // 사용자의 그룹 정보 조회 헬퍼 메서드
  private async getUserGroup(userId: string) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId }
    });
    
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

    return { user, membership, group_id: membership.group_id };
  }

  // 복용 완료 처리
  async completeDose(
    user_id: string,
    medi_id: string,
    time_of_day: 'morning' | 'afternoon' | 'evening',
    actual_dose: number,
    notes?: string,
  ): Promise<DoseHistory> {
    // 🔥 오늘 날짜 문자열
    const todayString = new Date().toISOString().split('T')[0];
    // 🔥 Date 객체로 변환 (자정 00:00:00)
    const todayDate = new Date(todayString);
    
    try {
      // 사용자의 그룹 정보 조회
      const { group_id } = await this.getUserGroup(user_id);

      // 🔥 체크 버튼으로 생성된 레코드만 조회 (배출 완료 레코드 제외)
      // notes에 "[배출완료]"가 포함된 레코드는 제외
      // 오늘 날짜의 기록만 조회 (이전 날짜 기록은 무시)
      let checkHistory = await this.doseHistoryRepository
        .createQueryBuilder('dh')
        .where('dh.user_id = :user_id', { user_id })
        .andWhere('dh.medi_id = :medi_id', { medi_id })
        .andWhere('dh.time_of_day = :time_of_day', { time_of_day })
        .andWhere('DATE(dh.dose_date) = :today', { today: todayString })
        .andWhere('dh.notes NOT LIKE :dispensePattern', { dispensePattern: '%[배출완료]%' })
        .getOne();

      if (checkHistory) {
        // 🔥 기존 체크 버튼 레코드가 있으면 업데이트
        checkHistory.actual_dose = actual_dose;
        checkHistory.status = actual_dose === 0 ? DoseStatus.MISSED : DoseStatus.COMPLETED;
        checkHistory.completed_at = new Date();
        if (notes) checkHistory.notes = notes;
        return await this.doseHistoryRepository.save(checkHistory);
      } else {
        // 🔥 새 체크 버튼 레코드 생성 (배출 완료 레코드와 별도)
        const newCheckHistory = new DoseHistory();
        newCheckHistory.history_id = uuidv4();
        newCheckHistory.group_id = group_id;
        newCheckHistory.user_id = user_id;
        newCheckHistory.medi_id = medi_id;
        newCheckHistory.time_of_day = time_of_day;
        newCheckHistory.dose_date = todayDate;
        newCheckHistory.scheduled_dose = actual_dose; // 임시로 같은 값 사용
        newCheckHistory.actual_dose = actual_dose;
        newCheckHistory.status = actual_dose === 0 ? DoseStatus.MISSED : DoseStatus.COMPLETED;
        newCheckHistory.completed_at = new Date();
        if (notes) newCheckHistory.notes = notes;
        return await this.doseHistoryRepository.save(newCheckHistory);
      }
    } catch (error) {
      console.error('복용 완료 처리 오류:', error);
      throw new Error('복용 기록 저장에 실패했습니다.');
    }
  }

  // 복용 기록 조회
  async getDoseHistory(
    user_id: string,
    medi_id?: string,
    start_date?: string,
    end_date?: string,
  ): Promise<DoseHistory[]> {
    try {
      const queryBuilder = this.doseHistoryRepository.createQueryBuilder('dh')
        .where('dh.user_id = :user_id', { user_id });

      if (medi_id) {
        queryBuilder.andWhere('dh.medi_id = :medi_id', { medi_id });
      }

      if (start_date && end_date) {
        queryBuilder.andWhere('dh.dose_date BETWEEN :start_date AND :end_date', {
          start_date,
          end_date,
        });
      }

      return await queryBuilder
        .orderBy('dh.dose_date', 'DESC')
        .addOrderBy('dh.time_of_day', 'ASC')
        .getMany();
    } catch (error) {
      console.error('복용 기록 조회 오류:', error);
      return [];
    }
  }

  // 주간 복용 통계
  async getWeeklyStats(user_id: string, start_date: string) {
    try {
      const endDate = new Date(start_date);
      endDate.setDate(endDate.getDate() + 6);
      const end_date = endDate.toISOString().split('T')[0];

      // 해당 주의 복용 기록 조회
      const doseHistories = await this.doseHistoryRepository
        .createQueryBuilder('dh')
        .where('dh.user_id = :user_id', { user_id })
        .andWhere('dh.dose_date BETWEEN :start_date AND :end_date', {
          start_date,
          end_date,
        })
        .getMany();

      const total_completed = doseHistories.filter(h => h.status === DoseStatus.COMPLETED).length;
      const missed_doses = doseHistories.filter(h => h.status === DoseStatus.MISSED).length;
      const total_scheduled = doseHistories.length;
      const completion_rate = total_scheduled > 0 ? 
        Math.round((total_completed / total_scheduled) * 100) : 0;

      return {
        total_scheduled,
        total_completed,
        completion_rate,
        missed_doses,
        daily_stats: [], // 간단한 버전에서는 빈 배열   
      };
    } catch (error) {
      console.error('주간 통계 조회 오류:', error);
      return {
        total_scheduled: 0,
        total_completed: 0,
        completion_rate: 0,
        missed_doses: 0,
        daily_stats: [],
      };
    }
  }

  // 오늘의 복용 진행률
  async getTodayProgress(user_id: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

      // 🔥 1. 오늘의 스케줄 조회 (Schedule 테이블)
      const todaySchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.medicine', 'medicine')
        .where('schedule.user_id = :user_id', { user_id })
        .andWhere('schedule.day_of_week = :dayOfWeek', { dayOfWeek })
        .getMany();

      console.log(`🔍 [getTodayProgress] ${user_id}의 오늘(${dayOfWeek}) 스케줄:`, todaySchedules.length);

      // 🔥 2. 오늘의 복용 기록 조회 (DoseHistory 테이블, 24시간 기준 초기화)
      // 🔥 DATE 함수를 사용하여 날짜 부분만 비교 (시간 무시)
      // 🔥 체크 버튼으로 생성된 레코드만 조회 (배출 완료 레코드 제외)
      const todayHistories = await this.doseHistoryRepository
        .createQueryBuilder('dh')
        .where('dh.user_id = :user_id', { user_id })
        .andWhere('DATE(dh.dose_date) = :today', { today })
        .andWhere('dh.notes NOT LIKE :dispensePattern', { dispensePattern: '%[배출완료]%' })
        .getMany();

      console.log(`🔍 [getTodayProgress] ${user_id}의 복용 기록:`, todayHistories.length);

      // 🔥 3. 스케줄과 복용 기록 병합 (실제 기록만 인정)
            const now = new Date();
      const todayStart = new Date(today); // 오늘 00:00:00
      
      // 복용 시간 매핑 (기본값, 실제로는 사용자 설정값 사용 가능)
      const timeSlotHours = {
        morning: 8,
        afternoon: 13,
        evening: 19
      };
      
      const todaySchedulesWithStatus = todaySchedules
        .map(schedule => {
          const history = todayHistories.find(
            h => h.medi_id === schedule.medi_id && h.time_of_day === schedule.time_of_day
          );

          // 🔥 히스토리가 있으면 그 status 사용, 없으면 null (프론트에서 처리)
          // 시간이 지났다고 자동으로 'missed'로 판단하지 않음!
          let status: DoseStatus | null = history?.status || null;
          
          // 🔥 새로운 스케줄이 등록된 경우: 스케줄 생성 시간이 완료 시간보다 나중이면 완료 상태 무시
          if (status === DoseStatus.COMPLETED && schedule.created_at && history?.completed_at) {
            const scheduleCreatedDate = new Date(schedule.created_at);
            const completedDate = new Date(history.completed_at);
            
            // 🔥 스케줄 생성 시간이 완료 시간보다 나중이면, 새로운 스케줄이므로 완료 상태 무시
            if (scheduleCreatedDate > completedDate) {
              status = null; // 새로운 스케줄이므로 복용 완료 필요
            }
          }

          return {
            medi_id: schedule.medi_id,
            medi_name: schedule.medicine?.name || '약 이름 없음',
            time_of_day: schedule.time_of_day,
            scheduled_dose: schedule.dose,
            actual_dose: history?.actual_dose,
            status: status, // null = 아직 기록 안 됨 (복용 예정 또는 확인 필요)
            completed_at: history?.completed_at?.toISOString(),
            schedule_created_at: schedule.created_at, // 🔥 스케줄 생성 시간 추가
          };
        })
        .filter(schedule => {
          // 🔥 약 이름이 없는 항목은 제외
          if (!schedule.medi_name || schedule.medi_name === '약 이름 없음') {
            console.log(`⚠️ [getTodayProgress] 약 이름 없는 스케줄 제외: medi_id=${schedule.medi_id}`);
            return false;
          }
          
          // 🔥 오늘 생성된 스케줄은 항상 포함 (제외 없음)
          // 모든 스케줄을 표시하도록 필터링 로직 제거
          return true;
        });

      // 🔥 필터링 후의 스케줄 개수로 계산 (시간 기준 status 반영)
      const scheduled = todaySchedulesWithStatus.length;
      const completed = todaySchedulesWithStatus.filter(s => s.status === DoseStatus.COMPLETED).length;
      const missed = todaySchedulesWithStatus.filter(s => s.status === DoseStatus.MISSED).length;
      const completion_rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

      return {
        user_id,
        user_name: null, // 호출자가 채워줌
        todaySchedules: todaySchedulesWithStatus,
        summary: {
          totalScheduled: scheduled,
          completed,
          missed,
          partial: 0,
          pending: scheduled - completed - missed,
          progressPercentage: completion_rate,
        },
        // 🔥 호환성을 위해 기존 필드도 유지
        scheduled,
        completed,
        missed,
        completion_rate,
      };
    } catch (error) {
      console.error('오늘 진행률 조회 오류:', error);
      return {
        user_id,
        user_name: null,
        todaySchedules: [],
        summary: {
          totalScheduled: 0,
          completed: 0,
          missed: 0,
          partial: 0,
          pending: 0,
          progressPercentage: 0,
        },
        scheduled: 0,
        completed: 0,
        missed: 0,
        completion_rate: 0,
      };
    }
  }

  // 가족 전체 복용 통계 (그룹 기반)
  async getFamilyStats(group_id: string) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 해당 그룹의 모든 기록 조회
      const histories = await this.doseHistoryRepository
        .createQueryBuilder('dh')
        .where('dh.group_id = :group_id', { group_id })
        .andWhere('dh.dose_date = :today', { today })
        .andWhere('dh.notes NOT LIKE :dispensePattern', { dispensePattern: '%[배출완료]%' })
        .getMany();

      const total_completed = histories.filter(h => h.status === DoseStatus.COMPLETED).length;
      const total_scheduled = histories.length;
      const completion_rate = total_scheduled > 0 ? 
        Math.round((total_completed / total_scheduled) * 100) : 0;

      return {
        total_scheduled,
        total_completed,
        completion_rate,
        member_count: 0, // 간단한 버전
      };
    } catch (error) {
      console.error('가족 통계 조회 오류:', error);
      return {
        total_scheduled: 0,
        total_completed: 0,
        completion_rate: 0,
        member_count: 0,
      };
    }
  }

  // 🔥 더 상세한 가족 통계 (시간대별, 멤버별 분석)
  async getDetailedFamilyStats(group_id: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentHour = new Date().getHours();
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

      // 가족 구성원 정보 조회 (멤버십을 통해 role 정보 포함)
      const familyMembers = await this.membershipRepository
        .createQueryBuilder('membership')
        .innerJoin('membership.user', 'user')
        .where('membership.group_id = :group_id', { group_id })
        .select(['user.user_id', 'user.name', 'membership.role'])
        .getRawMany();

      // 오늘의 모든 복용 기록 조회
      const todayHistories = await this.doseHistoryRepository
        .createQueryBuilder('dh')
        .where('dh.group_id = :group_id', { group_id })
        .andWhere('dh.dose_date = :today', { today })
        .andWhere('dh.notes NOT LIKE :dispensePattern', { dispensePattern: '%[배출완료]%' })
        .getMany();

      // 🔥 오늘 요일의 스케줄만 조회 (수정됨!)
      const scheduledDoses = await this.scheduleRepository
        .createQueryBuilder('s')
        .where('s.group_id = :group_id', { group_id })
        .andWhere('s.day_of_week = :dayOfWeek', { dayOfWeek })
        .select(['s.user_id', 's.medi_id', 's.time_of_day', 's.dose'])
        .getMany();
      
      console.log(`🔍 [getDetailedFamilyStats] 오늘(${dayOfWeek}) 스케줄: ${scheduledDoses.length}개`);

      // 시간대별 분석
      const timeSlots = {
        morning: { start: 6, end: 11, label: '아침' },
        afternoon: { start: 12, end: 17, label: '점심' },
        evening: { start: 18, end: 23, label: '저녁' }
      };

      // 각 시간대별 상세 통계
      const timeBasedStats = Object.entries(timeSlots).map(([timeOfDay, timeInfo]) => {
        const scheduledForTime = scheduledDoses.filter(s => s.time_of_day === timeOfDay);
        const completedForTime = todayHistories.filter(h => 
          h.time_of_day === timeOfDay && h.status === DoseStatus.COMPLETED
        );
        const missedForTime = todayHistories.filter(h => 
          h.time_of_day === timeOfDay && h.status === DoseStatus.MISSED
        );

        // 🔥 실제 기록만 사용 (시간 기반 자동 판단 제거)
        // remaining = 스케줄은 있는데 아직 기록(completed/missed) 안 된 것
        const remainingForTime = scheduledForTime.length - completedForTime.length - missedForTime.length;
        
        return {
          timeOfDay,
          label: timeInfo.label,
          scheduled: scheduledForTime.length,
          completed: completedForTime.length,
          missed: missedForTime.length, // 실제로 'missed'로 기록된 것만
          remaining: Math.max(remainingForTime, 0), // 아직 기록 안 된 것 (복용 예정 또는 확인 필요)
          completionRate: scheduledForTime.length > 0 ? 
            Math.round((completedForTime.length / scheduledForTime.length) * 100) : 0
        };
      });

      // 멤버별 상세 통계
      const memberStats = familyMembers.map(member => {
        const memberScheduled = scheduledDoses.filter(s => s.user_id === member.user_user_id);
        const memberCompleted = todayHistories.filter(h => 
          h.user_id === member.user_user_id && h.status === DoseStatus.COMPLETED
        );
        const memberMissed = todayHistories.filter(h => 
          h.user_id === member.user_user_id && h.status === DoseStatus.MISSED
        );

        const totalScheduled = memberScheduled.length;
        const totalCompleted = memberCompleted.length;
        const totalMissed = memberMissed.length;
        const remaining = totalScheduled - totalCompleted - totalMissed;

        return {
          user_id: member.user_user_id,
          name: member.user_name,
          role: member.membership_role,
          scheduled: totalScheduled,
          completed: totalCompleted,
          missed: totalMissed,
          remaining: remaining > 0 ? remaining : 0,
          completionRate: totalScheduled > 0 ? 
            Math.round((totalCompleted / totalScheduled) * 100) : 0
        };
      });

      // 전체 요약
      const totalScheduled = scheduledDoses.length;
      const totalCompleted = todayHistories.filter(h => h.status === DoseStatus.COMPLETED).length;
      const totalMissed = todayHistories.filter(h => h.status === DoseStatus.MISSED).length;
      const totalRemaining = totalScheduled - totalCompleted - totalMissed;

      return {
        summary: {
          total_scheduled: totalScheduled,
          total_completed: totalCompleted,
          total_missed: totalMissed,
          total_remaining: totalRemaining > 0 ? totalRemaining : 0,
          completion_rate: totalScheduled > 0 ? 
            Math.round((totalCompleted / totalScheduled) * 100) : 0,
          member_count: familyMembers.length
        },
        timeBasedStats,
        memberStats,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('상세 가족 통계 조회 오류:', error);
      return {
        summary: {
          total_scheduled: 0,
          total_completed: 0,
          total_missed: 0,
          total_remaining: 0,
          completion_rate: 0,
          member_count: 0
        },
        timeBasedStats: [],
        memberStats: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // 🔥 새로 추가: 오늘의 시간대별 복용 완료 상태 조회
  async getTodayCompletionStatus(user_id: string, medi_id?: string, date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(targetDate).getDay()];
      
      // 🔥 DATE 함수를 사용하여 날짜 부분만 비교 (24시간 기준 초기화)
      // 🔥 체크 버튼으로 생성된 레코드만 조회 (배출 완료 레코드 제외)
      const queryBuilder = this.doseHistoryRepository
        .createQueryBuilder('dh')
        .where('dh.user_id = :user_id', { user_id })
        .andWhere('DATE(dh.dose_date) = :date', { date: targetDate })
        .andWhere('dh.notes NOT LIKE :dispensePattern', { dispensePattern: '%[배출완료]%' });

      if (medi_id) {
        queryBuilder.andWhere('dh.medi_id = :medi_id', { medi_id });
      }

      const histories = await queryBuilder.getMany();
      
      // 🔥 스케줄 정보 조회 (새로운 스케줄 등록 확인용)
      const scheduleQueryBuilder = this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.user_id = :user_id', { user_id })
        .andWhere('schedule.day_of_week = :dayOfWeek', { dayOfWeek });
      
      if (medi_id) {
        scheduleQueryBuilder.andWhere('schedule.medi_id = :medi_id', { medi_id });
      }
      
      const schedules = await scheduleQueryBuilder.getMany();

      if (medi_id) {
        // 특정 약물의 시간대별 완료 상태 (오늘 날짜만 조회)
        // 🔥 새로운 스케줄이 등록된 경우 완료 상태 무시
        const getStatusForTimeSlot = (timeOfDay: 'morning' | 'afternoon' | 'evening') => {
          const history = histories.find(h => h.time_of_day === timeOfDay && h.status === DoseStatus.COMPLETED);
          if (!history) return false;
          
          // 🔥 해당 시간대의 스케줄 찾기
          const schedule = schedules.find(s => s.time_of_day === timeOfDay);
          if (!schedule) return false;
          
          // 🔥 스케줄 생성 시간이 완료 시간보다 나중이면 새로운 스케줄이므로 완료 상태 무시
          if (schedule.created_at && history.completed_at) {
            const scheduleCreatedDate = new Date(schedule.created_at);
            const completedDate = new Date(history.completed_at);
            
            if (scheduleCreatedDate > completedDate) {
              return false; // 새로운 스케줄이므로 복용 완료 필요
            }
          }
          
          return true;
        };
        
        const status = {
          morning: getStatusForTimeSlot('morning'),
          afternoon: getStatusForTimeSlot('afternoon'),
          evening: getStatusForTimeSlot('evening')
        };
        
        // 🔥 클라이언트 호환성을 위해 직접 status 반환 (completion_status 래핑 제거)
        return {
          medi_id,
          date: targetDate,
          morning: status.morning,
          afternoon: status.afternoon,
          evening: status.evening
        };
      } else {
        // 모든 약물의 시간대별 완료 상태 (약물별로 그룹화, 오늘 날짜만)
        const statusByMedicine: Record<string, any> = {};
        
        // 🔥 약물별로 초기화
        schedules.forEach(schedule => {
          if (!statusByMedicine[schedule.medi_id]) {
            statusByMedicine[schedule.medi_id] = {
              medi_id: schedule.medi_id,
              morning: false,
              afternoon: false,
              evening: false
            };
          }
        });
        
        // 🔥 오늘 날짜의 기록만 처리 (24시간 기준 초기화)
        histories.forEach(history => {
          // 🔥 날짜 확인 (이중 체크)
          const historyDate = history.dose_date instanceof Date 
            ? history.dose_date.toISOString().split('T')[0]
            : history.dose_date;
          
          // 🔥 오늘 날짜가 아니면 무시 (24시간 기준 초기화)
          if (historyDate !== targetDate) {
            return;
          }
          
          if (!statusByMedicine[history.medi_id]) {
            statusByMedicine[history.medi_id] = {
              medi_id: history.medi_id,
              morning: false,
              afternoon: false,
              evening: false
            };
          }
          
          // 🔥 새로운 스케줄이 등록된 경우 완료 상태 무시
          const schedule = schedules.find(s => 
            s.medi_id === history.medi_id && 
            s.time_of_day === history.time_of_day
          );
          
          if (schedule && schedule.created_at && history.completed_at) {
            const scheduleCreatedDate = new Date(schedule.created_at);
            const completedDate = new Date(history.completed_at);
            
            // 🔥 스케줄 생성 시간이 완료 시간보다 나중이면 새로운 스케줄이므로 완료 상태 무시
            if (scheduleCreatedDate > completedDate) {
              return; // 새로운 스케줄이므로 복용 완료 필요 (false 유지)
            }
          }
          
          // 🔥 COMPLETED 상태만 완료로 표시
          if (history.status === DoseStatus.COMPLETED) {
            statusByMedicine[history.medi_id][history.time_of_day] = true;
          }
        });
        
        return Object.values(statusByMedicine);
      }
    } catch (error) {
      console.error('오늘 복용 완료 상태 조회 오류:', error);
      return medi_id ? { 
        medi_id, 
        date: date || new Date().toISOString().split('T')[0],
        morning: false,
        afternoon: false,
        evening: false
      } : [];
    }
  }

  // ===================================================================
  //  TDB-Client GUI 연동 API
  // ===================================================================
  async getDoseHistoryByMachineId(machine_id: string, start_date: string) {
    const histories = await this.doseHistoryRepository.createQueryBuilder('history')
      .leftJoinAndSelect('history.user', 'user')
      .where('history.group_id IN (SELECT group_id FROM machine WHERE machine_id = :machine_id)', { machine_id })
      .andWhere('history.completed_at >= :start_date', { start_date }) // ★★★ 날짜 기준으로 필터링
      .orderBy('history.completed_at', 'DESC')
      .getMany();

    return histories.map(h => ({
      dispensed_at: h.completed_at,
      user_name: h.user ? h.user.name : '알 수 없음',
      result: h.status,
    }));
  }

  // ===================================================================
  //  🔥 배치 API: 가족 전체의 오늘 스케줄 한 번에 조회
  // ===================================================================
  async getFamilyTodaySchedules(group_id: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

      // 1. 가족 구성원 정보 조회
      const familyMembers = await this.membershipRepository
        .createQueryBuilder('membership')
        .innerJoin('membership.user', 'user')
        .where('membership.group_id = :group_id', { group_id })
        .select(['user.user_id', 'user.name', 'membership.role'])
        .getRawMany();

      if (familyMembers.length === 0) {
        return {
          members: []
        };
      }

      const memberIds = familyMembers.map(m => m.user_user_id);

      // 2. 오늘의 모든 스케줄 조회 (약물 + 영양제)
      const todaySchedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.medicine', 'medicine')
        .where('schedule.group_id = :group_id', { group_id })
        .andWhere('schedule.day_of_week = :dayOfWeek', { dayOfWeek })
        .andWhere('schedule.user_id IN (:...memberIds)', { memberIds })
        .select([
          'schedule.user_id',
          'schedule.medi_id',
          'schedule.time_of_day',
          'schedule.dose',
          'schedule.created_at',
          'medicine.name'
        ])
        .getMany();

      // 3. 오늘의 모든 복용 기록 조회 (24시간 기준 초기화)
      // 🔥 DATE 함수를 사용하여 날짜 부분만 비교 (시간 무시)
      // 🔥 체크 버튼으로 생성된 레코드만 조회 (배출 완료 레코드 제외)
      const todayHistories = await this.doseHistoryRepository
        .createQueryBuilder('dh')
        .where('dh.group_id = :group_id', { group_id })
        .andWhere('DATE(dh.dose_date) = :today', { today })
        .andWhere('dh.user_id IN (:...memberIds)', { memberIds })
        .andWhere('dh.notes NOT LIKE :dispensePattern', { dispensePattern: '%[배출완료]%' })
        .getMany();

      // 4. 약물 목록 조회 (약물명 매핑용)
      const medicines = await this.medicineRepository
        .createQueryBuilder('m')
        .where('m.group_id = :group_id', { group_id })
        .select(['m.medi_id', 'm.name'])
        .getMany();

      const medicineMap = new Map(medicines.map(m => [m.medi_id, m.name]));

      // 5. 데이터 가공: 구성원별로 그룹화
      const result = familyMembers.map(member => {
        const userId = member.user_user_id;
        const userName = member.user_name;

        // 해당 구성원의 오늘 스케줄 필터링
        const memberSchedules = todaySchedules.filter(s => s.user_id === userId);
        
        // 약물과 영양제 분리
        const medicineSchedules: any[] = [];
        const supplementSchedules: any[] = [];

        memberSchedules.forEach(schedule => {
          const isSupplement = schedule.medi_id && schedule.medi_id.startsWith('supplement_');
          const medicineName = medicineMap.get(schedule.medi_id) || schedule.medicine?.name || '알 수 없음';
          
          // 해당 스케줄의 복용 기록 찾기 (오늘 날짜만, 24시간 기준 초기화)
          const history = todayHistories.find(h => {
            // 🔥 날짜 확인 (이중 체크)
            const historyDate = h.dose_date instanceof Date 
              ? h.dose_date.toISOString().split('T')[0]
              : h.dose_date;
            
            // 🔥 오늘 날짜가 아니면 무시
            if (historyDate !== today) {
              return false;
            }
            
            return h.user_id === userId &&
            h.medi_id === schedule.medi_id &&
                   h.time_of_day === schedule.time_of_day;
          });

          const scheduleData = {
            medi_id: schedule.medi_id,
            name: medicineName,
            time_of_day: schedule.time_of_day,
            scheduled_dose: schedule.dose,
            actual_dose: history?.actual_dose,
            status: history?.status || null,
            completed_at: history?.completed_at ? history.completed_at.toISOString() : undefined,
            schedule_created_at: schedule.created_at ? schedule.created_at.toISOString() : undefined
          };

          if (isSupplement) {
            supplementSchedules.push(scheduleData);
          } else {
            medicineSchedules.push(scheduleData);
          }
        });

        return {
          user_id: userId,
          name: userName,
          medicines: medicineSchedules,
          supplements: supplementSchedules
        };
      });

      return {
        members: result
      };
    } catch (error) {
      console.error('가족 오늘 스케줄 배치 조회 오류:', error);
      return {
        members: []
      };
    }
  }
} 