import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('tablet_master')
@Index('idx_name', ['name'])
@Index('idx_company', ['company_name'])
@Index('idx_name_search', ['name'])
export class TabletMaster {
  @PrimaryColumn({ type: 'varchar', length: 50, comment: '제품신고번호' })
  report_no: string;

  @Column({ type: 'varchar', length: 200, nullable: false, comment: '제품명' })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '업체명' })
  company_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '인허가번호' })
  license_no: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '제품형태' })
  product_shape: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '형태' })
  shape: string;

  @Column({ type: 'text', nullable: true, comment: '성상/외형' })
  dispos: string;

  @Column({ type: 'text', nullable: true, comment: '주요기능성' })
  primary_function: string;

  @Column({ type: 'text', nullable: true, comment: '섭취방법' })
  intake_method: string;

  @Column({ type: 'text', nullable: true, comment: '섭취시 주의사항' })
  precautions: string;

  @Column({ type: 'text', nullable: true, comment: '부작용 (SEQESITM)' })
  side_effects: string;

  @Column({ type: 'text', nullable: true, comment: '보관방법' })
  storage_method: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '유통기한' })
  shelf_life: string;

  @Column({ type: 'text', nullable: true, comment: '원재료명' })
  raw_materials: string;

  @Column({ type: 'text', nullable: true, comment: '기준규격' })
  standard_spec: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '허가일자' })
  permit_date: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '생성일시' })
  create_date: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '최종수정일시' })
  last_update_date: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', comment: 'DB 등록일시' })
  created_at: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP', comment: 'DB 수정일시' })
  updated_at: Date;
}

