import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/entities/users.entity';
import { Medicine } from '../shared/entities/medicine.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { v4 as uuidv4 } from 'uuid';

export enum DoseStatus {
  COMPLETED = 'completed',
  MISSED = 'missed',
  PARTIAL = 'partial',
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

@Entity('dose_history')
export class DoseHistory {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  history_id: string = uuidv4();

  @Column({ type: 'varchar', length: 50, nullable: true })
  group_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  medi_id: string;

  @Column({
    type: 'enum',
    enum: ['morning', 'afternoon', 'evening'],
  })
  time_of_day: TimeOfDay;

  @Column({ type: 'date' })
  dose_date: Date;

  @Column({ type: 'int' })
  scheduled_dose: number;

  @Column({ type: 'int', default: 0 })
  actual_dose: number;

  @Column({
    type: 'enum',
    enum: ['completed', 'missed', 'partial'],
    default: 'missed',
  })
  status: DoseStatus;

  @Column({ 
    type: 'datetime', 
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)'
  })
  completed_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // 관계 설정
  @ManyToOne(() => UserGroup)
  @JoinColumn({ name: 'group_id', referencedColumnName: 'group_id' })
  group: UserGroup;

  @ManyToOne(() => User, (user) => user.doseHistories)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user: User;

  // 복합키 외래키: (medi_id, group_id) → medicine.(medi_id, group_id)
  @ManyToOne(() => Medicine, (medicine) => medicine.doseHistories)
  @JoinColumn([
    { name: 'medi_id', referencedColumnName: 'medi_id' },
    { name: 'group_id', referencedColumnName: 'group_id' }
  ])
  medicine: Medicine;
} 