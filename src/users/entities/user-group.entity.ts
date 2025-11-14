import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './users.entity';
import { UserGroupMembership } from './user-group-membership.entity';
import { Medicine } from '../../shared/entities/medicine.entity';
import { Machine } from '../../machine/entities/machine.entity';

@Entity('user_group')
export class UserGroup {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  group_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  group_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  parent_user_id: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  // 관계 설정
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'parent_user_id', referencedColumnName: 'user_id' })
  parentUser: User;

  @OneToMany(() => UserGroupMembership, (membership) => membership.group)
  memberships: UserGroupMembership[];

  @OneToMany(() => Medicine, (medicine) => medicine.group)
  medicines: Medicine[];

  @OneToMany(() => Machine, (machine) => machine.group)
  machines: Machine[];
} 