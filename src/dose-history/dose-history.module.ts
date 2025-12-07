import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { DoseHistoryService } from './dose-history.service';

interface CompleteDoseDto {
  user_id: string;
  medi_id: string;
  time_of_day: 'morning' | 'afternoon' | 'evening';
  actual_dose: number;
  notes?: string;
}

@Controller('dose-history')
export class DoseHistoryController {
  constructor(private readonly doseHistoryService: DoseHistoryService) {}

  @Post('complete')
  async completeDose(@Body() completeDoseDto: CompleteDoseDto) {
    const { user_id, medi_id, time_of_day, actual_dose, notes } = completeDoseDto;
    
    try {
      const result = await this.doseHistoryService.completeDose(
        user_id,
        medi_id,
        time_of_day,
        actual_dose,
        notes,
      );
      
      return {
        success: true,
        message: '복용 기록이 저장되었습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @Get('history/:user_id')
  async getDoseHistory(
    @Param('user_id') user_id: string,
    @Query('medi_id') medi_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    try {
      const result = await this.doseHistoryService.getDoseHistory(
        user_id,
        medi_id,
        start_date,
        end_date,
      );
      
      return {
        success: true,
        message: '복용 기록을 조회했습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: [],
      };
    }
  }

  @Get('weekly-stats/:user_id')
  async getWeeklyStats(
    @Param('user_id') user_id: string,
    @Query('start_date') start_date: string,
  ) {
    try {
      const result = await this.doseHistoryService.getWeeklyStats(user_id, start_date);
      
      return {
        success: true,
        message: '주간 통계를 조회했습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @Get('today-progress/:user_id')
  async getTodayProgress(@Param('user_id') user_id: string) {
    try {
      const result = await this.doseHistoryService.getTodayProgress(user_id);
      
      return {
        success: true,
        message: '오늘의 복용 진행률을 조회했습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @Get('family-stats/:connect')
  async getFamilyStats(@Param('connect') connect: string) {
    try {
      const result = await this.doseHistoryService.getFamilyStats(connect);
      
      return {
        success: true,
        message: '가족 복용 통계를 조회했습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @Get('family-detailed-stats/:connect')
  async getDetailedFamilyStats(@Param('connect') connect: string) {
    try {
      const result = await this.doseHistoryService.getDetailedFamilyStats(connect);
      
      return {
        success: true,
        message: '상세 가족 복용 통계를 조회했습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // 🔥 배치 API: 가족 전체의 오늘 스케줄 한 번에 조회
  @Get('family-today-schedules/:group_id')
  async getFamilyTodaySchedules(@Param('group_id') group_id: string) {
    try {
      const result = await this.doseHistoryService.getFamilyTodaySchedules(group_id);
      
      return {
        success: true,
        message: '가족 오늘 스케줄을 조회했습니다.',
        data: result,
      };
    } catch (error) {
      console.error('가족 오늘 스케줄 조회 오류:', error);
      return {
        success: false,
        message: error.message || '가족 오늘 스케줄 조회에 실패했습니다.',
        data: { members: [] },
      };
    }
  }

  // 🔥 새로 추가: 오늘의 복용 완료 상태 조회 (시간대별)
  @Get('today-status')
  async getTodayCompletionStatus(
    @Query('user_id') userId: string,
    @Query('medi_id') mediId?: string,
    @Query('date') date?: string
  ) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const result = await this.doseHistoryService.getTodayCompletionStatus(userId, mediId, targetDate);
      return { 
        success: true, 
        message: '오늘의 복용 완료 상태를 조회했습니다.',
        data: result 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message,
        data: null 
      };
    }
  }

  /**
   * 🔥 호환성 추가: 복용 완료 처리 - 프론트엔드 호환 경로
   */
  @Post()
  async completeDoseCompat(@Body() completeDoseDto: CompleteDoseDto) {
    return this.completeDose(completeDoseDto);
  }

  /**
   * 🔥 호환성 추가: 사용자 복용 기록 조회 - 프론트엔드 호환 경로
   */
  @Get('user/:user_id')
  async getDoseHistoryCompat(
    @Param('user_id') user_id: string,
    @Query('medi_id') medi_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.getDoseHistory(user_id, medi_id, start_date, end_date);
  }

  /**
   * 🔥 호환성 추가: 주간 통계 조회 - 프론트엔드 호환 경로
   */
  @Get('statistics/:user_id')
  async getWeeklyStatsCompat(
    @Param('user_id') user_id: string,
    @Query('start_date') start_date: string,
  ) {
    return this.getWeeklyStats(user_id, start_date);
  }

  /**
   * 🔥 호환성 추가: 복용 완료 처리 - 프론트엔드 taken 경로
   */
  @Post('taken')
  async completeDoseTaken(@Body() completeDoseDto: CompleteDoseDto) {
    return this.completeDose(completeDoseDto);
  }

  // ===================================================================
  //  TDB-Client GUI 연동 API
  // ===================================================================
  @Get('machine/:machine_id')
  async getDoseHistoryForMachine(
    @Param('machine_id') machine_id: string,
    @Query('start_date') start_date: string, // ★★★ start_date로 변경
  ) {
    try {
      // start_date가 없으면 기본값으로 어제 날짜 설정
      const startDateValue = start_date || new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const result = await this.doseHistoryService.getDoseHistoryByMachineId(
        machine_id,
        startDateValue,
      );
       
      return {
        success: true,
        message: '최근 배출 기록을 조회했습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: [],
      };
    }
  }
} 