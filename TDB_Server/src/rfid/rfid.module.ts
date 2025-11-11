import { Module } from '@nestjs/common';
import { RfidController } from './rfid.controller';
import { RfidService } from './rfid.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserGroupMembership])],
  controllers: [RfidController],
  providers: [RfidService],
})
export class RfidModule {}
