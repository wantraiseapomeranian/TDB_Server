import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      Schedule,
      MachineSlot,
      User,
      UserGroupMembership,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}