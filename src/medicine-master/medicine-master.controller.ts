import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { MedicineMasterService } from './medicine-master.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';

@UseGuards(AccessTokenGuard)
@Controller('medicine-master')
export class MedicineMasterController {
  constructor(private readonly medicineMasterService: MedicineMasterService) {}

  /**
   * 의약품 마스터 데이터 검색
   * GET /api/medicine-master/search?query=타이레놀&limit=20
   */
  @Get('search')
  async searchMedicine(
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      return {
        success: false,
        message: 'query 파라미터가 필요합니다.',
        data: [],
      };
    }

    const limitNum = limit ? parseInt(limit, 10) : 20;
    const results = await this.medicineMasterService.searchMedicine(query, limitNum);

    return {
      success: true,
      data: results,
      message: `"${query}" 검색 결과: ${results.length}개`,
    };
  }

  // 🔥 건강기능식품 검색은 tablet-master 컨트롤러로 이동 (중복 제거)
  // @Get('tablet/search') 엔드포인트는 제거됨

  /**
   * 통합 검색 (의약품 + 건강기능식품)
   * GET /api/medicine-master/search-all?query=비타민&limit=20
   */
  @Get('search-all')
  async searchAll(
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      return {
        success: false,
        message: 'query 파라미터가 필요합니다.',
        data: { medicines: [], tablets: [] },
      };
    }

    const limitNum = limit ? parseInt(limit, 10) : 20;
    const results = await this.medicineMasterService.searchAll(query, limitNum);

    return {
      success: true,
      data: results,
      message: `"${query}" 검색 결과: 의약품 ${results.medicines.length}개, 건강기능식품 ${results.tablets.length}개`,
    };
  }

  /**
   * 제품신고번호로 의약품 조회
   * GET /api/medicine-master/report/:reportNo
   */
  @Get('report/:reportNo')
  async findMedicineByReportNo(@Param('reportNo') reportNo: string) {
    const result = await this.medicineMasterService.findMedicineByReportNo(reportNo);

    if (!result) {
      return {
        success: false,
        message: '의약품을 찾을 수 없습니다.',
        data: null,
      };
    }

    return {
      success: true,
      data: result,
    };
  }
}

