import { Module } from '@nestjs/common';
import { DispenseController } from './dispense.controller';
import { DispenseService } from './dispense.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/users.entity';
import { DoseHistory } from '../dose-history/dose-history.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      DoseHistory,
      UserGroupMembership,
      MachineSlot,
    ]),
  ],
  controllers: [DispenseController],
  providers: [DispenseService],
})
export class DispenseModule {}
