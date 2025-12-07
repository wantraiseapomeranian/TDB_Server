import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoseHistoryController } from './dose-history.controller';
import { DoseHistoryService } from './dose-history.service';
import { DoseHistory } from './dose-history.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { User } from '../users/entities/users.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Medicine } from '../shared/entities/medicine.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoseHistory, Schedule, User, UserGroup, UserGroupMembership, Medicine])
  ],
  controllers: [DoseHistoryController],
  providers: [DoseHistoryService],
  exports: [DoseHistoryService],
})
export class DoseHistoryModule {} 