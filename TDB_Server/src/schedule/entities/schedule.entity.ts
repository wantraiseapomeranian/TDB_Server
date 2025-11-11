import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/users.entity';
import { Medicine } from '../../shared/entities/medicine.entity';
import { UserGroup } from '../../users/entities/user-group.entity';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

@Entity('schedule')
export class Schedule {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  schedule_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  group_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  medi_id: string;

  @Column({
    type: 'enum',
    enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  })
  day_of_week: DayOfWeek;

  @Column({
    type: 'enum',
    enum: ['morning', 'afternoon', 'evening'],
  })
  time_of_day: TimeOfDay;

  @Column({ type: 'int' })
  dose: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // FK 관계 정의
  @ManyToOne(() => UserGroup)
  @JoinColumn({ name: 'group_id', referencedColumnName: 'group_id' })
  group: UserGroup;

  @ManyToOne(() => User, (user) => user.schedules)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user: User;

  // 복합키 외래키: (medi_id, group_id) → medicine.(medi_id, group_id)
  @ManyToOne(() => Medicine, (medicine) => medicine.schedules)
  @JoinColumn([
    { name: 'medi_id', referencedColumnName: 'medi_id' },
    { name: 'group_id', referencedColumnName: 'group_id' }
  ])
  medicine: Medicine;
}
