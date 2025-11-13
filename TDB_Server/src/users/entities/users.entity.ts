import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
} from 'typeorm';
import { Machine } from 'src/machine/entities/machine.entity';
import { Schedule } from 'src/schedule/entities/schedule.entity';
import { DoseHistory } from 'src/dose-history/dose-history.entity';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'int', nullable: true })
  age: number;

  @Column({ type: 'date', nullable: true })
  birthDate: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  k_uid: string;

  @Column({ type: 'int', default: 0 })
  took_today: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refresh_token: string;

  // OneToMany relationships
  @OneToMany(() => Schedule, (schedule) => schedule.user)
  schedules: Schedule[];

  @OneToMany(() => DoseHistory, (doseHistory) => doseHistory.user)
  doseHistories: DoseHistory[];
}
