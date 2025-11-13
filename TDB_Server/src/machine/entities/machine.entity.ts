import { Entity, Column, PrimaryColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserGroup } from 'src/users/entities/user-group.entity';
import { Medicine } from 'src/medicine/entities/medicine.entity';
import { User } from '@/users/entities/users.entity';

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

  @ManyToOne(() => Medicine, (medicine) => medicine.machines) // 'machines'는 Medicine 엔티티의 속성 이름
  medicine: Medicine;

  @ManyToOne(() => User, (user) => user.medicines) // 'medicines'는 User 엔티티의 속성 이름
  @JoinColumn({ name: 'user_id' }) // 실제 DB 컬럼 이름 (SQL 스키마에 따라 조절 필요)
  user: User;

}
