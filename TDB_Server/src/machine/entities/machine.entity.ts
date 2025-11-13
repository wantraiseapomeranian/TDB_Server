import { Entity, Column, PrimaryColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserGroup } from 'src/users/entities/user-group.entity';

@Entity('machine')
export class Machine {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  machine_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  group_id: string;

  @Column({ type: 'tinyint', default: 3 })
  max_slot: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  error_status: string;

  @Column({ type: 'datetime', nullable: true })
  last_error_at: Date;

  // 관계 설정
  @ManyToOne(() => UserGroup)
  @JoinColumn({ name: 'group_id', referencedColumnName: 'group_id' })
  group: UserGroup;

  @OneToMany('MachineSlot', 'machine')  
  slots: any[];

}
