import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Machine } from './machine.entity';
import { Medicine } from '../../shared/entities/medicine.entity';

@Entity('machine_slot')
export class MachineSlot {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  machine_id: string;

  @PrimaryColumn({ type: 'tinyint' })
  slot_number: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  medi_id: string;

  @Column({ type: 'int', default: 0 })
  total: number;

  @Column({ type: 'int', default: 0 })
  remain: number;

  // 관계 설정
  @ManyToOne(() => Machine, (machine) => machine.slots, { 
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  })
  @JoinColumn({ name: 'machine_id', referencedColumnName: 'machine_id' })
  machine: Machine;

  @ManyToOne(() => Medicine, { 
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE' 
  })
  @JoinColumn({ name: 'medi_id', referencedColumnName: 'medi_id' })
  medicine: Medicine;
} 