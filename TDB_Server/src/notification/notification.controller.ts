import { Controller, Get, Post, Put, Body, Query, Param, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';
import { NotificationType } from './entities/notification.entity';

@UseGuards(AccessTokenGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 알림 목록 조회
   */
  @Get('list')
  async getNotifications(
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    console.log(`🔥 [NotificationController] 알림 목록 조회: userId=${userId}`);
    
    const result = await this.notificationService.getNotifications(
      userId,
      limit ? parseInt(limit.toString()) : 50,
      offset ? parseInt(offset.toString()) : 0
    );
    
    return result;
  }

  /**
   * 알림 읽음 처리 (POST)
   */
  @Post('read')
  async markAsRead(@Body() data: { 
    notificationId?: string; 
    userId?: string;
    markAll?: boolean;
  }) {
    console.log(`🔥 [NotificationController] 알림 읽음 처리:`, data);
    
    if (data.markAll && data.userId) {
      return await this.notificationService.markAllAsRead(data.userId);
    }
    
    if (data.notificationId) {
      return await this.notificationService.markAsRead(data.notificationId);
    }
    
    return {
      success: false,
      error: 'notificationId 또는 markAll이 필요합니다.'
    };
  }

  /**
   * 특정 알림 읽음 처리 (PUT)
   */
  @Put('read/:id')
  async markNotificationAsRead(@Param('id') id: string) {
    console.log(`🔥 [NotificationController] 알림 읽음 처리 (PUT): id=${id}`);
    
    return await this.notificationService.markAsRead(id);
  }

  /**
   * 새 알림 생성
   */
  @Post()
  async createNotification(@Body() data: {
    userId: string;
    type?: NotificationType;
    title: string;
    message: string;
    data?: any;
  }) {
    console.log(`🔥 [NotificationController] 알림 생성:`, data);
    
    return await this.notificationService.createNotification({
      user_id: data.userId,
      type: data.type || NotificationType.MEDICINE_REMINDER,
      title: data.title,
      message: data.message,
      data: data.data,
    });
  }
}