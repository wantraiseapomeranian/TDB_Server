// src/users/users.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController, UsersCompatController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/users.entity';
import { UserGroup } from './entities/user-group.entity';
import { UserGroupMembership } from './entities/user-group-membership.entity';
import { Machine } from '../machine/entities/machine.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserGroup, UserGroupMembership, Machine])],
  controllers: [UsersController, UsersCompatController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
