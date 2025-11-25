import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Schedule } from '../schedule/entities/schedule.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { UserRole } from '../users/entities/user-role.enum';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(MachineSlot)
    private readonly machineSlotRepository: Repository<MachineSlot>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,
  ) {}

  /**
   * 알림 생성
   */
  async createNotification(data: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }) {
    try {
      const notification = this.notificationRepository.create({
        notification_id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        read: false,
      });

      await this.notificationRepository.save(notification);
      
      this.logger.log(`✅ 알림 생성: ${data.user_id} - ${data.title}`);
      
      return {
        success: true,
        data: notification,
      };
    } catch (error) {
      //this.logger.error(`❌ 알림 생성 실패:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 알림 목록 조회
   */
  async getNotifications(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const [notifications, total] = await this.notificationRepository.findAndCount({
        where: { user_id: userId },
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset,
      });

      return {
        success: true,
        data: {
          notifications,
          total,
          hasMore: total > offset + limit,
        },
      };
    } catch (error) {
      this.logger.error(`❌ 알림 조회 실패:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 알림 읽음 처리
   */
  async markAsRead(notificationId: string) {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { notification_id: notificationId },
      });

      if (!notification) {
        throw new Error('알림을 찾을 수 없습니다.');
      }

      notification.read = true;
      notification.read_at = new Date();
      await this.notificationRepository.save(notification);

      return {
        success: true,
        data: notification,
      };
    } catch (error) {
      this.logger.error(`❌ 알림 읽음 처리 실패:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 모든 알림 읽음 처리
   */
  async markAllAsRead(userId: string) {
    try {
      await this.notificationRepository.update(
        { user_id: userId, read: false },
        { read: true, read_at: new Date() }
      );

      return {
        success: true,
        message: '모든 알림을 읽음 처리했습니다.',
      };
    } catch (error) {
      this.logger.error(`❌ 전체 읽음 처리 실패:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🔔 복용 시간 알림 (매 시간 정각에 실행)
   */
  @Cron('0 * * * *')
  async checkMedicineReminders() {
    try {
      const currentHour = new Date().getHours();
      let timeOfDay: 'morning' | 'afternoon' | 'evening';

      // 시간대 결정
      if (currentHour >= 6 && currentHour < 12) {
        timeOfDay = 'morning';
      } else if (currentHour >= 12 && currentHour < 18) {
        timeOfDay = 'afternoon';
      } else if (currentHour >= 18 && currentHour < 22) {
        timeOfDay = 'evening';
      } else {
        return; // 새벽 시간대는 알림 제외
      }

      this.logger.log(`🔔 [Cron] 복용 시간 알림 체크: ${timeOfDay} (${currentHour}시)`);

      // 오늘 요일
      const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

      // 해당 시간대에 복용해야 하는 스케줄 조회
      const schedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.medicine', 'medicine')
        .leftJoinAndSelect('schedule.user', 'user')
        .where('schedule.day_of_week = :dayOfWeek', { dayOfWeek })
        .andWhere('schedule.time_of_day = :timeOfDay', { timeOfDay })
        .getMany();

      this.logger.log(`📋 발견된 스케줄: ${schedules.length}개`);

      // 각 스케줄에 대해 알림 생성
      for (const schedule of schedules) {
        if (!schedule.user || !schedule.medicine) continue;

        await this.createNotification({
          user_id: schedule.user_id,
          type: NotificationType.MEDICINE_REMINDER,
          title: '💊 복용 시간입니다',
          message: `${schedule.medicine.name}을(를) ${schedule.dose}개 복용하세요.`,
          data: {
            schedule_id: schedule.schedule_id,
            medicine_id: schedule.medi_id,
            medicine_name: schedule.medicine.name,
            dose: schedule.dose,
            time_of_day: timeOfDay,
          },
        });
      }

      this.logger.log(`✅ 복용 알림 ${schedules.length}개 전송 완료`);
    } catch (error) {
      this.logger.error(`❌ 복용 시간 알림 체크 실패:`, error);
    }
  }

  /**
   * 🔔 약물 잔량 알림 (매일 오전 9시 실행)
   */
  @Cron('0 9 * * *')
  async checkLowStockAlerts() {
    try {
      this.logger.log(`🔔 [Cron] 약물 잔량 체크 시작`);

      // 잔량이 5개 이하인 슬롯 조회
      const lowStockSlots = await this.machineSlotRepository
        .createQueryBuilder('slot')
        .leftJoinAndSelect('slot.medicine', 'medicine')
        .leftJoinAndSelect('slot.machine', 'machine')
        .where('slot.remain <= :threshold', { threshold: 5 })
        .andWhere('slot.remain > 0')
        .getMany();

      this.logger.log(`⚠️ 잔량 부족 슬롯: ${lowStockSlots.length}개`);

      // 각 슬롯에 대해 해당 그룹의 부모 사용자에게 알림
      for (const slot of lowStockSlots) {
        if (!slot.machine || !slot.medicine) continue;

        // 해당 그룹의 부모 계정 찾기
        const parentMembership = await this.membershipRepository.findOne({
          where: { 
            group_id: slot.machine.group_id,
            role: UserRole.PARENT
          },
          relations: ['user']
        });

        if (!parentMembership?.user) continue;

        await this.createNotification({
          user_id: parentMembership.user.user_id,
          type: NotificationType.LOW_STOCK,
          title: '⚠️ 약물 부족 알림',
          message: `${slot.medicine.name}의 잔량이 ${slot.remain}개 남았습니다. 약을 보충해주세요.`,
          data: {
            machine_id: slot.machine_id,
            slot_number: slot.slot_number,
            medicine_id: slot.medi_id,
            medicine_name: slot.medicine.name,
            remain: slot.remain,
            total: slot.total,
            percentage: Math.round((slot.remain / slot.total) * 100),
          },
        });
      }

      this.logger.log(`✅ 잔량 알림 ${lowStockSlots.length}개 전송 완료`);
    } catch (error) {
      this.logger.error(`❌ 약물 잔량 알림 체크 실패:`, error);
    }
  }

  /**
   * 🧹 오래된 알림 자동 삭제 (매일 새벽 3시)
   */
  @Cron('0 3 * * *')
  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.notificationRepository.delete({
        created_at: LessThan(thirtyDaysAgo),
        read: true,
      });

      this.logger.log(`🧹 오래된 알림 ${result.affected}개 삭제 완료`);
    } catch (error) {
      this.logger.error(`❌ 알림 정리 실패:`, error);
    }
  }
}
