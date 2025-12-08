import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/users.entity';
import { DataSource, Repository } from 'typeorm';
import { DoseHistory, DoseStatus } from '../dose-history/dose-history.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { MachineSlot } from '../machine/entities/machine-slot.entity';

class DispensedItemDto {
    @IsNotEmpty()
    medi_id: string;

    @IsNotEmpty()
    @IsNumber()
    slot: number;

    @IsNotEmpty()
    count: number;
}

export class DispenseReportDto {
  @IsString()
  @IsNotEmpty()
  machine_id: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  time: 'morning' | 'afternoon' | 'evening';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispensedItemDto)
  items: DispensedItemDto[];

  @IsString()
  @IsNotEmpty()
  result: 'completed' | 'partial' | 'failed';

  @IsString()
  @IsOptional()
  client_tx_id?: string;
}


@Injectable()
export class DispenseService {
  private readonly logger = new Logger(DispenseService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(DoseHistory)
    private readonly doseHistoryRepository: Repository<DoseHistory>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,
    @InjectRepository(MachineSlot)
    private readonly machineSlotRepository: Repository<MachineSlot>,
    private readonly dataSource: DataSource,
  ) {}

  async reportDispense(report: DispenseReportDto) {
    this.logger.log(`배출 결과 처리 중: user ${report.user_id}, result: ${report.result}`);

    // 'failed' 상태에서는 재고 및 사용자 상태 변경 없이 기록만 함
    if (report.result === 'failed') {
      this.logger.warn(`배출 실패 보고: user ${report.user_id}. 복용 기록만 저장합니다.`);
      // 여기서 DoseHistory만 저장하는 로직을 추가할 수 있으나, 현재는 아래 트랜잭션 로직에서 처리되도록 둠.
      // 'failed' 시에는 재고 차감, took_today 업데이트가 모두 스킵됨.
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const user = await transactionalEntityManager.findOne(User, { where: { user_id: report.user_id }});
      if (!user) {
          throw new NotFoundException(`사용자를 찾을 수 없습니다: ${report.user_id}`);
      }

      const membership = await transactionalEntityManager.findOne(UserGroupMembership, { where: { user_id: user.user_id }});
      if (!membership) {
          throw new NotFoundException(`사용자의 그룹 정보를 찾을 수 없습니다: ${report.user_id}`);
      }

      // 재고 차감 로직 (성공 시에만)
      if (report.result === 'completed' || report.result === 'partial') {
        for (const item of report.items) {
          const slot = await transactionalEntityManager.findOne(MachineSlot, {
            where: {
              machine_id: report.machine_id,
              slot_number: item.slot,
            },
          });

          if (!slot) {
            this.logger.error(`슬롯을 찾을 수 없음: machine=${report.machine_id}, slot=${item.slot}. 트랜잭션을 롤백합니다.`);
            throw new InternalServerErrorException(`슬롯 정보를 찾을 수 없습니다: ${item.slot}`);
          }

          if (slot.remain < item.count) {
            this.logger.warn(
                `재고 부족 경고: machine=${report.machine_id}, slot=${item.slot}, ` +
                `remain=${slot.remain}, requested=${item.count}. 재고는 0으로 차감됩니다.`
            );
          }
          
          slot.remain = Math.max(0, slot.remain - item.count);
          await transactionalEntityManager.save(MachineSlot, slot);

          this.logger.log(
            `재고 차감 완료: machine=${report.machine_id}, slot=${item.slot}, ` +
            `medi_id=${item.medi_id}, count=${item.count}, new_remain=${slot.remain}`
          );
        }
      }

      // 🔥 각 약물에 대해 복용 기록 처리 (중복 체크 포함)
      const todayString = new Date().toISOString().split('T')[0];
      
      for (const item of report.items) {
        // 🔥 각 약물별 actualDose 계산 (전체 합계가 아닌 개별 약물의 count 사용)
        const itemActualDose = (report.result === 'completed' || report.result === 'partial') ? item.count : 0;
        
        // 🔥 배출 완료 레코드 생성 (체크 버튼 레코드와 별도로 저장)
        // 🔥 배출 완료 레코드는 항상 새로 생성 (체크 버튼 레코드와 분리)
        const dispenseHistory = transactionalEntityManager.create(DoseHistory, {
          group_id: membership.group_id,
          user_id: report.user_id,
          medi_id: item.medi_id,
          time_of_day: report.time,
          dose_date: new Date(todayString),
          scheduled_dose: item.count,
          actual_dose: itemActualDose, // 🔥 각 약물별 count 사용
          status: report.result as DoseStatus,
          completed_at: new Date(),
          notes: `[배출완료] Machine: ${report.machine_id}, ClientTx: ${report.client_tx_id || 'N/A'}`
        });
        await transactionalEntityManager.save(DoseHistory, dispenseHistory);
        this.logger.log(`배출 완료 레코드 생성: user=${report.user_id}, medi_id=${item.medi_id}, time=${report.time}, actual_dose=${itemActualDose} (체크 버튼 레코드와 별도)`);
      }
      
      this.logger.log(`복용 기록 처리 완료: user ${report.user_id}, items=${report.items.length}개`);

      let tookToday = user.took_today;
      if (report.result === 'completed') {
          user.took_today = 1;
          await transactionalEntityManager.save(User, user);
          tookToday = 1;
          this.logger.log(`사용자 ${report.user_id}의 took_today 상태를 1로 업데이트했습니다 (time: ${report.time})`);
      }

      return {
          status: "ok",
          took_today: tookToday
      };
    });
  }
}
