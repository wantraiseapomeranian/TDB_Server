import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicineMaster } from './entities/medicine-master.entity';
import { TabletMaster } from './entities/tablet-master.entity';
import { MedicineMasterService } from './medicine-master.service';
import { MedicineMasterController } from './medicine-master.controller';
import { TabletMasterController } from '../tablet-master/tablet-master.controller';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicineMaster, TabletMaster]),
    AuthModule,
    UsersModule,
  ],
  controllers: [MedicineMasterController, TabletMasterController],
  providers: [MedicineMasterService],
  exports: [MedicineMasterService],
})
export class MedicineMasterModule {}

