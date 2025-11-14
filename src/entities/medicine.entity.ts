import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { UserGroup } from '../users/entities/user-group.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { DoseHistory } from '../dose-history/dose-history.entity';

@Entity('medicine')
export class Medicine {
  // 복합 Primary Key (medi_id, group_id)
  @PrimaryColumn({ type: 'varchar', length: 50 })
  medi_id: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  group_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'tinyint', default: 0 })
  warning: number;

  @Column({ type: 'date', nullable: true })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date;

  @Column({ type: 'json', nullable: true })
  target_users: any;

  @Column({ type: 'tinyint', default: 1 })
  listed_only: number;

  // Relations
  @ManyToOne(() => UserGroup, (group) => group.medicines)
  @JoinColumn({ name: 'group_id', referencedColumnName: 'group_id' })
  group: UserGroup;

  @OneToMany(() => MachineSlot, (slot) => slot.medicine)
  slots: MachineSlot[];

  @OneToMany(() => Schedule, (schedule) => schedule.medicine)
  schedules: Schedule[];

  @OneToMany(() => DoseHistory, (history) => history.medicine)
  doseHistories: DoseHistory[];
} 