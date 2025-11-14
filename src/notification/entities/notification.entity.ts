import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/users.entity';

export enum NotificationType {
  MEDICINE_REMINDER = 'medicine_reminder',
  LOW_STOCK = 'low_stock',
  MISSED_DOSE = 'missed_dose',
  MACHINE_ERROR = 'machine_error',
  MACHINE_OFFLINE = 'machine_offline',
  SCHEDULE_UPDATE = 'schedule_update',
}

@Entity('notification')
export class Notification {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  notification_id: string;

  @Column({ type: 'varchar', length: 255 })
  user_id: string;

  @Column({ 
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.MEDICINE_REMINDER
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ type: 'json', nullable: true })
  data: any;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  read_at: Date;

  // 관계 설정
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user: User;
}
