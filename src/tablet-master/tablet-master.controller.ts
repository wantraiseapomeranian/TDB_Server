import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { MedicineMasterService } from '../medicine-master/medicine-master.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';

@UseGuards(AccessTokenGuard)
@Controller('tablet-master')
export class TabletMasterController {
  constructor(private readonly medicineMasterService: MedicineMasterService) {}

  /**
   * 건강기능식품 마스터 데이터 검색
   * GET /api/tablet-master/search?query=비타민&limit=20
   */
  @Get('search')
  async searchTablet(
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
    const results = await this.medicineMasterService.searchTablet(query, limitNum);

    return {
      success: true,
      data: results,
      message: `"${query}" 검색 결과: ${results.length}개`,
    };
  }

  /**
   * 제품신고번호로 건강기능식품 조회
   * GET /api/tablet-master/report/:reportNo
   */
  @Get('report/:reportNo')
  async findTabletByReportNo(@Param('reportNo') reportNo: string) {
    const result = await this.medicineMasterService.findTabletByReportNo(reportNo);

    if (!result) {
      return {
        success: false,
        message: '건강기능식품을 찾을 수 없습니다.',
        data: null,
      };
    }

    return {
      success: true,
      data: result,
    };
  }
}

