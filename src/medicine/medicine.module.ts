import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicineService } from './medicine.service';
import { MedicineController } from './medicine.controller';
import { Medicine } from '../shared/entities/medicine.entity';
import { Machine } from '../machine/entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { DoseHistory } from '../dose-history/dose-history.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { MachineModule } from '../machine/machine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Medicine,
      Machine,
      MachineSlot,
      User,
      UserGroupMembership,
      Schedule,
      DoseHistory,
    ]),
    AuthModule,
    UsersModule,
    ScheduleModule,
    forwardRef(() => MachineModule), // 순환 참조 문제로 주석 처리
  ],
  controllers: [MedicineController],
  providers: [MedicineService],
  exports: [MedicineService],
})
export class MedicineModule {} 