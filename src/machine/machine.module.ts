// src/machine/machine.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MachineController } from './machine.controller';
import { MachineService } from './machine.service';
import { Medicine } from '../shared/entities/medicine.entity';
import { MachineSlot } from './entities/machine-slot.entity';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Machine } from './entities/machine.entity';
import { MedicineModule } from 'src/medicine/medicine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Machine,
      MachineSlot,
      User,
      UserGroupMembership,
      Schedule,
      Medicine, // MedicineModule을 통해 제공되므로 제거
    ]),
    AuthModule,
    UsersModule,
    forwardRef(() => MedicineModule),
    // ScheduleModule, // (추가)
  ],
  controllers: [MachineController],
  providers: [MachineService],
  exports: [MachineService], // MachineService를 export하여 다른 모듈에서 사용 가능
})
export class MachineModule {}
