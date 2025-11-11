import { Controller, Get, Post, Put, Param, Query, UseGuards, Body, Logger, Req } from '@nestjs/common';
import { MachineService } from './machine.service';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// DTO for Heartbeat
class HeartbeatInDto {
  @IsString()
  machine_id: string;

  @IsString()
  @IsOptional()
  status?: string = 'idle';

  @IsOptional()
  ts?: number = null;
}


@Controller('machine')
// @UseGuards(AccessTokenGuard) // 개발 중이면 주석처리해도 됨
export class MachineController {
  private readonly logger = new Logger(MachineController.name);

  constructor(private readonly machineService: MachineService) {}

  // ===================================================================
  // 🔥 디바이스 API (새로운 명세)
  // ===================================================================

  @Get('check')
  //@UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '기기 등록 여부 확인 (신규)', description: '기기 ID로 서버에 등록되어 있는지 확인합니다.' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'machine_id', required: true, type: String })
  async checkMachine(@Query('machine_id') machineId: string) {
    this.logger.log(`[Device API] 기기 등록 확인 요청: ${machineId}`);
    return this.machineService.checkMachine(machineId);
  }

  @Post('heartbeat')
  //@UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '기기 하트비트 전송 (신규)', description: '기기가 자신의 상태를 주기적으로 서버에 알립니다.' })
  @ApiBearerAuth()
  async machineHeartbeat(@Body() body: HeartbeatInDto, @Req() req) {
    // req.user는 JWT Strategy의 validate에서 반환된 값입니다.
    //this.logger.log(`[Device API] 하트비트 수신: ${req.user.id}`);
    return this.machineService.recordHeartbeat(body);
  }

  @Get('config')
  //@UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: '기기 설정 정보 조회 (신규)', description: '기기 동작에 필요한 설정 정보를 서버로부터 받아옵니다.' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'machine_id', required: true, type: String })
  async getMachineConfig(@Query('machine_id') machineId: string, @Req() req) {
    //this.logger.log(`[Device API] 설정 정보 요청: ${req.user.id}`);
    return this.machineService.getMachineConfig(machineId);
  }


  // ===================================================================
  // ✅ 기존 코드
  // ===================================================================

  // 전체 사용자 목록 조회
  @Get('users')
  getAllUsers() {
    return this.machineService.findAllUsers();
  }

  // 전체 약/영양제 목록 조회
  @Get('medicine')
  getAllMedicine() {
    return this.machineService.findAllMedicine();
  }

  // 전체 복용 스케줄 조회
  @Get('schedule')
  getAllSchedules() {
    return this.machineService.findAllSchedule();
  }

  // 등록된 기기 목록 조회
  @Get('list')
  getAllMachines() {
    return this.machineService.findAllMachine();
  }

  // UID(RFID) 기반 사용자 또는 기기 확인
  @Get('verify/:uid')
  verifyUid(@Param('uid') uid: string) {
    return this.machineService.verifyUid(uid);
  }

  // UID 기반, 오늘의 스케줄 조회
  @Get('today/:uid')
  getTodaySchedule(@Param('uid') uid: string) {
    return this.machineService.getTodayScheduleByUid(uid);
  }

  // 기기 ID 기준, 약 잔여량 및 슬롯 정보 조회
  @Get('remain/:machine_id')
  getMedicineRemain(@Param('machine_id') machine_id: string) {
    return this.machineService.getMedicineRemainByMachine(machine_id);
  }

  // 기기 ID 기준, 연동된 사용자 목록 조회
  @Get('users/:machine_id')
  getUsersByMachine(@Param('machine_id') machine_id: string) {
    return this.machineService.getUsersByMachineId(machine_id);
  }

  // 기기 ID 기준, 특정 날짜의 복용 스케줄 요약 조회
  @Get('schedule-by-date/:machine_id')
  getScheduleByDate(
    @Param('machine_id') machine_id: string,
    @Query('date') date: string,
  ) {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    return this.machineService.getSchedulesByMachineAndDate(
      machine_id,
      targetDate,
    );
  }

  // group_id 기준, 가족 기기 상태 조회 (대시보드용)
  @Get('family-status/:group_id')
  async getFamilyMachineStatus(@Param('group_id') group_id: string) {
    try {
      const result = await this.machineService.getMachineStatusByGroupId(group_id);
      
      return {
        success: true,
        message: '가족 기기 상태를 조회했습니다.',
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

  // 기기 상태 조회
  @Get('status/:machine_id')
  async getMachineStatus(@Param('machine_id') machine_id: string) {
    return this.machineService.getMachineStatus(machine_id);
  }

  // 기기 정보 업데이트
  @Put(':id')
  async updateMachine(
    @Param('id') id: string,
    @Body() updateData: any,
  ) {
    return this.machineService.updateMachine(id, updateData);
  }

  // 기기 슬롯 설정
  @Put('slots/:machine_id')
  async updateSlots(
    @Param('machine_id') machine_id: string,
    @Body() slotData: any,
  ) {
    return this.machineService.updateSlots(machine_id, slotData);
  }

  // 🔥 호환성 추가: 기기 에러 처리
  @Post('error')
  async reportError(@Body() body: {
    machine_id: string;
    error_type: string;
    error_message: string;
    slot?: number;
  }) {
    // TODO: 에러 정보를 데이터베이스에 저장
    console.log('🔥 [Machine] 에러 보고:', body);
    
    return {
      success: true,
      message: '에러가 기록되었습니다.'
    };
  }

  // 🔥 호환성 추가: 하드웨어 에러 신고 - 프론트엔드 호환 경로
  @Post('error-report')
  async reportHardwareError(@Body() errorData: {
    machine_id: string;
    error_details: string;
    slot?: number;
    timestamp?: string;
  }) {
    console.log(`🔥 [MachineController] 하드웨어 에러 신고 (프론트엔드 호환):`, errorData);
    
    // TODO: 실제 하드웨어 에러 처리 로직 구현
    return {
      success: true,
      data: {
        error_id: `hardware_error_${Date.now()}`,
        status: 'reported',
        message: '하드웨어 에러가 신고되었습니다.',
        ...errorData
      }
    };
  }

  // 🔥 호환성 추가: 기기 업데이트
  @Post('update')
  async updateMachineStatus(@Body() updateData: {
    machine_id: string;
    status?: string;
    firmware_version?: string;
    last_maintenance?: string;
  }) {
    console.log(`🔥 [MachineController] 기기 상태 업데이트:`, updateData);
    
    // TODO: 실제 기기 업데이트 로직 구현
    return {
      success: true,
      data: {
        update_id: `update_${Date.now()}`,
        status: 'updated',
        message: '기기 상태가 업데이트되었습니다.',
        ...updateData
      }
    };
  }

  // 🔥 호환성 추가: 기기별 날짜별 스케줄 조회
  @Get('schedules/:machine_id')
  getSchedulesByMachine(
    @Param('machine_id') machine_id: string,
    @Query('date') date: string,
  ) {
    return this.machineService.getSchedulesByMachineAndDate(machine_id, date);
  }
}
