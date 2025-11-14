import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispenserController } from './dispenser.controller';
import { DispenserService } from './dispenser.service';
import { Medicine } from '../shared/entities/medicine.entity';
import { User } from '../users/entities/users.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Machine } from '../machine/entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { DoseHistory } from '../dose-history/dose-history.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Medicine,
      User,
      UserGroup,
      UserGroupMembership,
      Machine,
      MachineSlot,
      Schedule,
      DoseHistory,
    ]),
    AuthModule, // AccessTokenGuard를 위해 AuthModule import
    UsersModule, // AccessTokenGuard를 위해 UsersModule import
  ],
  controllers: [DispenserController],
  providers: [DispenserService],
  exports: [DispenserService],
})
export class DispenserModule {} 