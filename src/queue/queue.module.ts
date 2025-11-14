import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/users.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { Machine } from '../machine/entities/machine.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Schedule, MachineSlot, Machine])],
  controllers: [QueueController],
  providers: [QueueService],
})
export class QueueModule {}
