import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { DispenserService } from './dispenser.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';


@UseGuards(AccessTokenGuard)
@Controller('dispenser')
export class DispenserController {
  constructor(private readonly dispenserService: DispenserService) {}

  /**
   * 1. 🔥 RFID 자동배출 - 메인 기능 (/api/dispenser/rfid-auto-dispense)
   * RFID 태그 인식 시 자동으로 오늘의 스케줄에 따라 약 배출
   */
  @Post('rfid-auto-dispense')
  async rfidAutoDispense(
    @Body()
    body: {
      k_uid: string;           // RFID UID (사용자 고유 ID)
      machine_id: string;      // 디스펜서 기기 ID
    },
  ) {
    if (!body.k_uid || !body.machine_id) {
      throw new BadRequestException('k_uid와 machine_id가 필요합니다.');
    }

    console.log(`🔥 [DispenserController] RFID 자동배출 요청:`, body);
    return this.dispenserService.rfidAutoDispense(body.k_uid, body.machine_id);
  }

  /**
   * 2. 스케줄 기반 수동배출 (/api/dispenser/schedule-dispense)
   * 앱에서 버튼 클릭 시 사용 (기존 기능)
   */
  @Post('schedule-dispense')
  async scheduleDispense(
    @Body()
    body: {
      machine_id: string;
      userId: string;
      medicineId: string;
      slot: number;
      quantity: number;
      reason?: string;
    },
  ) {
    if (!body.machine_id || !body.userId || !body.medicineId || !body.slot || !body.quantity) {
      throw new BadRequestException('필수 파라미터가 누락되었습니다.');
    }

    console.log(`🔥 [DispenserController] 스케줄 기반 수동배출 요청:`, body);
    return this.dispenserService.scheduleDispense(body);
  }

  /**
   * 3. 기기 상태 조회 (/api/dispenser/machine-status?machine_id={machine_id})
   */
  @Get('machine-status')
  async getMachineStatus(@Query('machine_id') machine_id: string) {
    if (!machine_id) {
      throw new BadRequestException('machine_id 파라미터가 필요합니다.');
    }

    console.log(`🔥 [DispenserController] 기기 상태 조회: machine_id=${machine_id}`);
    return this.dispenserService.getMachineStatus(machine_id);
  }

  /**
   * 3. 기기 상태 조회 (/api/dispenser/status/{machine_id}) - 호환성
   */
  @Get('status/:machine_id')
  async getMachineStatusByPath(@Param('machine_id') machine_id: string) {
    console.log(`🔥 [DispenserController] 경로 방식 기기 상태 조회: machine_id=${machine_id}`);
    return this.dispenserService.getMachineStatus(machine_id);
  }

  /**
   * 4. 오늘의 디스펜스 목록 조회 (/api/dispenser/dispense-list)
   */
  @Get('dispense-list')
  async getDispenseList(
    @Query('machine_id') machine_id?: string,
    @Query('userId') userId?: string,
  ) {
    console.log(`🔥 [DispenserController] 디스펜스 목록 조회: machine_id=${machine_id}, userId=${userId}`);
    return this.dispenserService.getDispenseList(machine_id, userId);
  }

  /**
   * 5. 슬롯 상태 조회 (/api/dispenser/slot-status)
   */
  @Get('slot-status')
  async getSlotStatus(@Query('machine_id') machine_id?: string) {
    console.log(`🔥 [DispenserController] 슬롯 상태 조회: machine_id=${machine_id}`);
    return this.dispenserService.getSlotStatus(machine_id);
  }

  /**
   * 6. 기기별 사용자 목록 조회 (/api/dispenser/users/by-machine?machine_id={machine_id})
   */
  @Get('users/by-machine')
  async getUsersByMachine(@Query('machine_id') machine_id: string) {
    if (!machine_id) {
      throw new BadRequestException('machine_id 파라미터가 필요합니다.');
    }

    console.log(`🔥 [DispenserController] 기기별 사용자 목록 조회: machine_id=${machine_id}`);
    
    // TODO: 실제 사용자 목록 조회 로직 구현
    return {
      success: true,
      data: {
        machine_id,
        users: [], // 임시 빈 배열
        message: '기기별 사용자 목록 API는 추가 구현이 필요합니다.'
      }
    };
  }

  /**
   * 7. 기기별 스케줄 조회 (/api/dispenser/schedules-by-date)
   */
  @Get('schedules-by-date')
  async getSchedulesByDate(
    @Query('machine_id') machine_id: string,
    @Query('date') date?: string,
  ) {
    if (!machine_id) {
      throw new BadRequestException('machine_id 파라미터가 필요합니다.');
    }

    console.log(`🔥 [DispenserController] 기기별 스케줄 조회: machine_id=${machine_id}, date=${date}`);
    return this.dispenserService.getDispenseList(machine_id);
  }

  /**
   * 6. 슬롯 충돌 디버깅 API - 모든 슬롯 정보 상세 조회
   */
  @Get('debug/slots/:machine_id')
  async debugSlots(@Param('machine_id') machine_id: string) {
    console.log(`🔍 [DispenserController] 슬롯 디버깅: ${machine_id}`);
    return this.dispenserService.debugAllSlots(machine_id);
  }

  // ===== 호환성 API (기존 앱 지원) =====

  /**
   * 🔥 호환성: UID 검증 (/api/dispenser/verify-uid)
   */
  @Post('verify-uid')
  async verifyUid(
    @Body()
    body: {
      machine_id: string;
      userId: string;
    },
  ) {
    console.log(`🔥 [DispenserController] UID 검증 (호환성):`, body);
    
    // TODO: 실제 UID 검증 로직 구현
    return {
      success: true,
      data: {
        verified: true,
        machine_id: body.machine_id,
        userId: body.userId,
        message: 'UID 검증 API는 추가 구현이 필요합니다.'
      }
    };
  }

  /**
   * 🔥 호환성: 디스펜스 결과 (/api/dispenser/dispense-result)
   */
  @Post('dispense-result')
  async dispenseResult(
    @Body()
    body: {
      machine_id: string;
      medicineId: string;
      slot: number;
      quantity: number;
      success: boolean;
      timestamp: string;
    },
  ) {
    console.log(`🔥 [DispenserController] 디스펜스 결과 (호환성):`, body);
    
    // TODO: 디스펜스 결과 처리 로직 구현
    return {
      success: true,
      data: {
        received: true,
        machine_id: body.machine_id,
        timestamp: new Date().toISOString(),
        message: '디스펜스 결과 API는 추가 구현이 필요합니다.'
      }
    };
  }

  /**
   * 🔥 호환성: 디스펜스 확인 (/api/dispenser/confirm)
   */
  @Post('confirm')
  async confirm(
    @Body()
    body: {
      machine_id: string;
      action: string;
    },
  ) {
    console.log(`🔥 [DispenserController] 디스펜스 확인 (호환성):`, body);
    
    return {
      success: true,
      data: {
        confirmed: true,
        machine_id: body.machine_id,
        action: body.action,
        message: '디스펜스 확인 완료'
      }
    };
  }
} 