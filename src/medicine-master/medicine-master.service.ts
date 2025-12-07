import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { MedicineMaster } from './entities/medicine-master.entity';
import { TabletMaster } from './entities/tablet-master.entity';

@Injectable()
export class MedicineMasterService {
  constructor(
    @InjectRepository(MedicineMaster)
    private readonly medicineMasterRepository: Repository<MedicineMaster>,
    @InjectRepository(TabletMaster)
    private readonly tabletMasterRepository: Repository<TabletMaster>,
  ) {}

  /**
   * 의약품 마스터 데이터 검색
   */
  async searchMedicine(query: string, limit: number = 20): Promise<MedicineMaster[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;

    return await this.medicineMasterRepository
      .createQueryBuilder('medicine')
      .where('medicine.name LIKE :searchTerm', { searchTerm })
      .orWhere('medicine.company_name LIKE :searchTerm', { searchTerm })
      .orderBy('medicine.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  /**
   * 건강기능식품 마스터 데이터 검색
   */
  async searchTablet(query: string, limit: number = 20): Promise<TabletMaster[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;

    return await this.tabletMasterRepository
      .createQueryBuilder('tablet')
      .where('tablet.name LIKE :searchTerm', { searchTerm })
      .orWhere('tablet.company_name LIKE :searchTerm', { searchTerm })
      .orderBy('tablet.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  /**
   * 통합 검색 (의약품 + 건강기능식품)
   */
  async searchAll(query: string, limit: number = 20): Promise<{
    medicines: MedicineMaster[];
    tablets: TabletMaster[];
  }> {
    const [medicines, tablets] = await Promise.all([
      this.searchMedicine(query, limit),
      this.searchTablet(query, limit),
    ]);

    return { medicines, tablets };
  }

  /**
   * 제품신고번호로 의약품 조회
   */
  async findMedicineByReportNo(reportNo: string): Promise<MedicineMaster | null> {
    return await this.medicineMasterRepository.findOne({
      where: { report_no: reportNo },
    });
  }

  /**
   * 제품신고번호로 건강기능식품 조회
   */
  async findTabletByReportNo(reportNo: string): Promise<TabletMaster | null> {
    return await this.tabletMasterRepository.findOne({
      where: { report_no: reportNo },
    });
  }
}

