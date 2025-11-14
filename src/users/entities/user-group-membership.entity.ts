import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.entity';
import { UserGroup } from './user-group.entity';
import { UserRole } from './user-role.enum';

@Entity('user_group_membership')
export class UserGroupMembership {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  group_id: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  user_id: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  joined_at: Date;

  // 관계 설정
  @ManyToOne(() => UserGroup, (group) => group.memberships, { 
    onDelete: 'CASCADE' 
  })
  @JoinColumn({ name: 'group_id', referencedColumnName: 'group_id' })
  group: UserGroup;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user: User;
} 