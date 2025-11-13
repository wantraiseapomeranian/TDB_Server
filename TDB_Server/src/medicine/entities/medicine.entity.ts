import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
} from 'typeorm';
import { Schedule } from 'src/schedule/entities/schedule.entity';
import { DoseHistory } from 'src/dose-history/dose-history.entity';

@Entity('medicine')
export class Medicine {
  // 복합 PK 구성
  @PrimaryColumn({ type: 'varchar', length: 50 })
  medi_id: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  connect: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'tinyint', default: 0 })
  warning: boolean;

  @Column({ type: 'date', nullable: true })
  start_date?: Date;

  @Column({ type: 'date', nullable: true })
  end_date?: Date;

  // 새로 추가: 복용 대상 사용자 목록
  @Column({ 
    type: 'json', 
    nullable: true,
    comment: '복용 대상 ["user1","user2"] 또는 NULL(전체)' 
  })
  target_users?: string[] | null;

  @OneToMany(() => Schedule, (schedule) => schedule.medicine)
  schedules: Schedule[];

  @OneToMany(() => DoseHistory, (doseHistory) => doseHistory.medicine)
  doseHistories: DoseHistory[];
}
