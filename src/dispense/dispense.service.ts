import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/users.entity';
import { Repository } from 'typeorm';
import { DoseHistory, DoseStatus } from '../dose-history/dose-history.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DispensedItemDto {
    @IsNotEmpty()
    medi_id: string;

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
  ) {}

  async reportDispense(report: DispenseReportDto) {
    this.logger.log(`배출 결과 처리 중: user ${report.user_id}, result: ${report.result}`);

    const user = await this.userRepository.findOne({ where: { user_id: report.user_id }});
    if (!user) {
        throw new NotFoundException(`사용자를 찾을 수 없습니다: ${report.user_id}`);
    }

    const membership = await this.membershipRepository.findOne({ where: { user_id: user.user_id }});
    if (!membership) {
        throw new NotFoundException(`사용자의 그룹 정보를 찾을 수 없습니다: ${report.user_id}`);
    }

    // TODO: client_tx_id를 사용하여 멱등성 처리 구현
    // TODO: result가 'partial' 또는 'failed'일 경우 notes 필드에 상세 사유 기록

    const doseQuantity = report.items.reduce((sum, item) => sum + item.count, 0);

    const historyEntry = this.doseHistoryRepository.create({
        group_id: membership.group_id,
        user_id: report.user_id,
        medi_id: report.items.length > 0 ? report.items[0].medi_id : null,
        time_of_day: report.time,
        dose_date: new Date(),
        scheduled_dose: doseQuantity, // 참고: 현재는 실제 배출량을 예정량으로 기록
        actual_dose: report.result === 'completed' ? doseQuantity : 0, // 참고: 'completed'가 아니면 0으로 기록
        status: report.result as DoseStatus,
        completed_at: new Date(),
        notes: `Machine: ${report.machine_id}, ClientTx: ${report.client_tx_id || 'N/A'}`
    });
    await this.doseHistoryRepository.save(historyEntry);
    this.logger.log(`복용 기록 저장 완료: user ${report.user_id}`);

    let tookToday = user.took_today;
    if (report.time === 'evening' && report.result === 'completed') {
        user.took_today = 1;
        await this.userRepository.save(user);
        tookToday = 1;
        this.logger.log(`사용자 ${report.user_id}의 took_today 상태를 1로 업데이트했습니다.`);
    }

    return {
        status: "ok",
        took_today: tookToday
    };
  }
}
