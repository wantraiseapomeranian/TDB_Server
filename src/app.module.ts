// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MedicineModule } from './medicine/medicine.module';
import { DispenserModule } from './dispenser/dispenser.module'; 
import { FamilyModule } from './family/family.module';
import { ScheduleModule as CustomScheduleModule } from './schedule/schedule.module';
import { DoseHistoryModule } from './dose-history/dose-history.module';
import { MachineModule } from './machine/machine.module';
import { NotificationModule } from './notification/notification.module';
import { SupplementModule } from './supplement/supplement.module';
import { RfidModule } from './rfid/rfid.module';
import { QueueModule } from './queue/queue.module';
import { DispenseModule } from './dispense/dispense.module';
import { DeviceModule } from './device/device.module';
import { MedicineMasterModule } from './medicine-master/medicine-master.module';

// Entities
import { User } from './users/entities/users.entity';
import { UserGroup } from './users/entities/user-group.entity';
import { UserGroupMembership } from './users/entities/user-group-membership.entity';
import { Medicine } from './shared/entities/medicine.entity';
import { Machine } from './machine/entities/machine.entity';
import { MachineSlot } from './machine/entities/machine-slot.entity';
import { Schedule } from './schedule/entities/schedule.entity';
import { DoseHistory } from './dose-history/dose-history.entity';
import { MedicineMaster } from './medicine-master/entities/medicine-master.entity';
import { TabletMaster } from './medicine-master/entities/tablet-master.entity';

@Module({
  imports: [
    // 환경 변수 설정
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // 스케줄러 모듈
    ScheduleModule.forRoot(),
    
    // 데이터베이스 연결 - 환경변수 기반으로 통합
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'TDB'),
        entities: [User, UserGroup, UserGroupMembership, Medicine, Machine, MachineSlot, Schedule, DoseHistory, MedicineMaster, TabletMaster],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
        timezone: '+09:00',
        charset: 'utf8mb4',
        retryAttempts: 3,
        retryDelay: 3000,
      }),
    }),
    
    // 애플리케이션 모듈들
    AuthModule,
    UsersModule,
    MedicineModule,
    DispenserModule,
    FamilyModule,
    CustomScheduleModule,
    DoseHistoryModule,
    MachineModule,
    NotificationModule,
    SupplementModule,
    RfidModule,
    QueueModule,
    DispenseModule,
    DeviceModule,
    MedicineMasterModule,
  ],
})
export class AppModule {}
