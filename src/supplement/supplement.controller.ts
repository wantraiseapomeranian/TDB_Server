import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { SupplementService } from './supplement.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';

@UseGuards(AccessTokenGuard)
@Controller('supplement')
export class SupplementController {
  constructor(private readonly supplementService: SupplementService) {}

  /**
   * 1. connect 코드 기준 영양제 목록 조회 - 기존 방식 (쿼리 파라미터)
   */
  @Get('list')
  async getSupplementList(@Query('connect') connect: string) {
    return this.supplementService.getSupplementList(connect);
  }

  /**
   * 4. 스케줄 저장 (Mock 처리)
   */
  @Post('schedule')
  async saveSchedule(): Promise<{ success: boolean; message: string }> {
    // TODO: 스케줄 저장 로직 구현 필요
    return { success: true, message: '스케줄 저장 기능은 구현 예정입니다.' }; 
  }

  /**
   * 5. 영양제 경고 상태 조회 (재고 부족 여부)
   */
  @Get('inventory')
  async getInventory(@Query('connect') connect: string) {
    // TODO: 인벤토리 조회 로직 구현 필요
    return { success: true, data: [], message: '인벤토리 조회 기능은 구현 예정입니다.' };
  }

  /**
   * 6. 경고 상태 수동 업데이트
   */
  @Put('warning')
  async updateWarning(
    @Body() body: { connect: string; supplementId: string; warning: boolean },
  ) {
    // TODO: 경고 상태 업데이트 로직 구현 필요
    return { success: true, message: '경고 상태 업데이트 기능은 구현 예정입니다.' };
  }

  /**
   * 7. 복용 완료 처리 → 경고 true로 전환
   */
  @Post('completion')
  async completeSupplement(
    @Body() body: { connect: string; supplementId: string },
  ) {
    return this.supplementService.deleteSupplement(body.connect, {
      supplementId: body.supplementId,
    });
  }

  /**
   * 🔥 호환성 추가: 영양제 등록 (/add/{memberId}) - 구체적인 라우트를 먼저 배치
   */
  @Post('add/:memberId')
  async addSupplement(
    @Param('memberId') memberId: string,
    @Body()
    data: {
      name: string;
      manufacturer?: string;
      ingredients?: string;
      primaryFunction?: string;
      intakeMethod?: string;
      precautions?: string;
      startDate?: string;
      endDate?: string;
      memberName?: string;
      memberType?: string;
      target_users?: string[] | null;
      totalQuantity?: string;
      slot?: number;
    },
  ) {
    console.log('🔥 [Supplement Controller - /add] 영양제 추가 요청:', { memberId, bodyData: Object.keys(data) });
    
    if (!memberId || memberId === 'undefined') {
      throw new BadRequestException('유효하지 않은 memberId입니다.');
    }
    
    // addSupplement 메서드에 맞는 데이터 형식으로 변환 - 🔥 의약품과 동일하게 처리
    const supplementData = {
      medi_id: `supplement_${Date.now()}`, // 고유 ID 생성
      name: data.name,
      totalQuantity: data.totalQuantity || '0', // 🔥 의약품과 동일: 0으로 시작 (나중에 업데이트)
      slot: data.slot, // 요청된 슬롯 (서비스에서 자동 할당 처리)
    };
    
    return this.supplementService.addSupplement(memberId, supplementData);
  }

  /**
   * 3. 영양제 상세 조회 (복합키: connect + medi_id)
   */
  @Get(':connect/:id')
  async getSupplementDetail(
    @Param('connect') connect: string,
    @Param('id') medi_id: string,
  ) {
    return this.supplementService.getSupplementDetail(connect, { supplementId: medi_id });
  }

  /**
   * 2. 영양제 등록 (원래 방식)
   */
  @Post(':memberId')
  async saveSupplement(
    @Param('memberId') memberId: string,
    @Body()
    data: {
      name: string;
      manufacturer?: string;
      ingredients?: string;
      primaryFunction?: string;
      intakeMethod?: string;
      precautions?: string;
      startDate?: string;
      endDate?: string;
      memberName?: string;
      memberType?: string;
      target_users?: string[] | null;
      totalQuantity?: string;
      slot?: number;
    },
  ) {
    console.log('🔥 [Supplement Controller] 파라미터 체크:', { memberId, bodyData: Object.keys(data) });
    
    if (!memberId || memberId === 'undefined') {
      throw new BadRequestException('유효하지 않은 memberId입니다.');
    }
    
    // addSupplement 메서드에 맞는 데이터 형식으로 변환 (슬롯은 서비스에서 자동 할당)
    const supplementData = {
      medi_id: `supplement_${Date.now()}`, // 고유 ID 생성
      name: data.name,
      totalQuantity: data.totalQuantity || '30', // 기본값 30개
      slot: data.slot, // 요청된 슬롯 (서비스에서 자동 할당 처리)
    };
    
    return this.supplementService.addSupplement(memberId, supplementData);
  }

  /**
   * 2-1. 영양제 수정
   */
  @Put(':memberId/:supplementId')
  async updateSupplement(
    @Param('memberId') memberId: string,
    @Param('supplementId') supplementId: string,
    @Body()
    data: {
      name: string;
      manufacturer?: string;
      ingredients?: string;
      primaryFunction?: string;
      intakeMethod?: string;
      precautions?: string;
      startDate?: string;
      endDate?: string;
      memberName?: string;
      memberType?: string;
      target_users?: string[] | null;
      totalQuantity?: string;
    },
  ) {
    // updateSupplement 메서드에 맞는 데이터 형식으로 변환
    const supplementData = {
      name: data.name,
      totalQuantity: data.totalQuantity,
    };
    
    return this.supplementService.updateSupplement(memberId, supplementId, supplementData);
  }

  /**
   * 2-2. 영양제 삭제
   */
  @Delete(':memberId/:supplementId')
  async deleteSupplement(
    @Param('memberId') memberId: string,
    @Param('supplementId') supplementId: string,
  ) {
    // 간단한 삭제 로직 - deleteSupplement 사용
    return this.supplementService.deleteSupplement(memberId, {
      supplementId: supplementId,
    });
  }

  /**
   * 🔥 호환성 추가: 영양제 목록 조회 - 프론트엔드 호환 (/{memberId})
   * 주의: 이 라우트는 가장 마지막에 배치하여 다른 경로와 충돌하지 않도록 함
   */
  @Get(':memberId')
  async getSupplementListByMember(@Param('memberId') memberId: string) {
    console.log(`🔥 [Supplement Controller] 프론트엔드 호환 영양제 목록 조회: memberId=${memberId}`);
    return this.supplementService.getSupplementList(memberId);
  }

  /**
   * 🔥 호환성 추가: 사용자별 영양제 목록 조회 (/user/{userId})
   */
  @Get('user/:userId')
  async getSupplementListByUser(@Param('userId') userId: string) {
    console.log(`🔥 [Supplement Controller] 사용자별 영양제 목록 조회: userId=${userId}`);
    return this.supplementService.getSupplementList(userId);
  }

  /**
   * 🔥 호환성 추가: 영양제 총량 업데이트
   */
  @Put('quantity/:memberId/:mediId')
  async updateSupplementQuantity(
    @Param('memberId') memberId: string,
    @Param('mediId') mediId: string,
    @Body() data: { totalQuantity: number },
  ) {
    console.log('🔥 [Supplement Controller - /quantity] 영양제 총량 업데이트 요청:', { memberId, mediId, totalQuantity: data.totalQuantity });
    
    if (!memberId || memberId === 'undefined') {
      throw new BadRequestException('유효하지 않은 memberId입니다.');
    }

    if (!mediId) {
      throw new BadRequestException('유효하지 않은 mediId입니다.');
    }

    if (!data.totalQuantity || data.totalQuantity < 0) {
      throw new BadRequestException('유효하지 않은 총량입니다.');
    }
    
    return this.supplementService.updateSupplementQuantity(memberId, mediId, data.totalQuantity);
  }

  /**
   * 🔥 호환성 추가: 영양제 재고 관리
   */
  @Get('inventory')
  async getSupplementInventory() {
    console.log(`🔥 [Controller] 영양제 재고 조회`);
    
    try {
      // TODO: 실제 재고 조회 로직 구현
      return {
        success: true,
        data: [],
        message: '영양제 재고 조회 API는 추가 구현이 필요합니다.'
      };
    } catch (error) {
      console.error(`🔥 [Controller] 영양제 재고 조회 실패:`, error);
      return {
        success: false,
        error: {
          message: error.message || '영양제 재고 조회에 실패했습니다.'
        }
      };
    }
  }

  /**
   * 🔥 호환성 추가: 영양제 복용 완료 처리
   */
  @Post('completion')
  async supplementCompletion(@Body() body: {
    supplementId: string;
    userId: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
    actualDose?: number;
    notes?: string;
  }) {
    console.log(`🔥 [Controller] 영양제 복용 완료 처리:`, body);
    
    try {
      // TODO: 실제 복용 완료 처리 로직 구현
      return {
        success: true,
        data: {
          completion_id: `supplement_completion_${Date.now()}`,
          message: '영양제 복용이 완료되었습니다.',
          ...body
        }
      };
    } catch (error) {
      console.error(`🔥 [Controller] 영양제 복용 완료 처리 실패:`, error);
      return {
        success: false,
        error: {
          message: error.message || '영양제 복용 완료 처리에 실패했습니다.'
        }
      };
    }
  }
}
