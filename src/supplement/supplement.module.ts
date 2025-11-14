// src/supplement/supplement.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplementController } from './supplement.controller';
import { SupplementService } from './supplement.service';
import { Medicine } from '../shared/entities/medicine.entity';
import { Machine } from '../machine/entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { MachineModule } from '../machine/machine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Medicine, Machine, MachineSlot, User, UserGroupMembership]),
    AuthModule,
    UsersModule,
    MachineModule,
  ],
  controllers: [SupplementController],
  providers: [SupplementService],
  exports: [SupplementService],
})
export class SupplementModule {}
