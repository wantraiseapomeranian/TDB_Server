import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MedicineService } from './medicine.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';
import { User } from '../auth/decorator/user.decorator';
import { ScheduleService } from '../schedule/schedule.service';

@UseGuards(AccessTokenGuard)
@Controller('medicine')
export class MedicineController {
  constructor(
    private readonly medicineService: MedicineService,
    private readonly scheduleService: ScheduleService,
  ) {}

  /**
   * 1. 약물 목록 조회 (/api/medicine/list/{userId})
   */
  @Get('list/:userId')
  async getMedicineListByUser(@Param('userId') userId: string) {
    console.log(`🔥 [MedicineController] 사용자별 약물 목록 조회: userId=${userId}`);
    return this.medicineService.getMedicineList(userId);
  }

  /**
   * 2. 약물 목록 조회 (/api/medicine/list?connect={userId})
   */
  @Get('list')
  async getMedicineList(@Query('connect') connect: string) {
    if (!connect) {
      throw new BadRequestException('connect 파라미터가 필요합니다.');
    }
    console.log(`🔥 [MedicineController] 약물 목록 조회: connect=${connect}`);
    return this.medicineService.getMedicineList(connect);
  }

  /**
   * 3. 약물 검색 (/api/medicine/search?query={query}&userId={userId})
   */
  @Get('search')
  async searchMedicine(
    @Query('query') query: string,
    @Query('userId') userId?: string,
    @Query('connect') connect?: string,
  ) {
    const searchUserId = userId || connect;
    
    if (!query) {
      throw new BadRequestException('검색어(query)가 필요합니다.');
    }
    if (!searchUserId) {
      throw new BadRequestException('사용자 ID(userId 또는 connect)가 필요합니다.');
    }

    console.log(`🔥 [MedicineController] 약물 검색: query="${query}", userId=${searchUserId}`);
    return this.medicineService.searchMedicine(searchUserId, query);
  }

  /**
   * 4. 약물 재고 조회 (/api/medicine/inventory?connect={userId})
   */
  @Get('inventory')
  async getMedicineInventory(@Query('connect') connect: string) {
    if (!connect) {
      throw new BadRequestException('connect 파라미터가 필요합니다.');
    }
    console.log(`🔥 [MedicineController] 약물 재고 조회: connect=${connect}`);
    return this.medicineService.getMedicineInventory(connect);
  }

  /**
   * 🔥 호환성: 약물 스케줄 조회 (/api/medicine/schedule/{medicineId}) - 구체적인 라우트 먼저
   */
  @Get('schedule/:medicineId')
  async getMedicineSchedule(
    @Param('medicineId') medicineId: string,
    @Query('memberId') memberId: string,
  ) {
    console.log(`🔥 [MedicineController] 약물 스케줄 조회: medicineId=${medicineId}, memberId=${memberId}`);
    
    if (!memberId) {
      throw new BadRequestException('사용자 ID(memberId)가 필요합니다.');
    }

    // ScheduleService를 직접 호출하여 스케줄 조회
    try {
      // ScheduleService를 직접 호출하여 스케줄 조회
      const result = await this.scheduleService.getSchedule(medicineId, memberId);
      const schedules = result.data.schedules;
      const slotInfo = result.data.slotInfo;
      
      console.log(`[MedicineController] 조회된 스케줄 개수: ${schedules.length}`);
      
      // 빈 배열인 경우 기본값으로 응답
      if (schedules.length === 0) {
        console.log(`[MedicineController] 스케줄이 없어서 기본값 반환`);
        
        return {
          data: {
            schedules: [],
            schedule: {
              mon: { morning: false, afternoon: false, evening: false },
              tue: { morning: false, afternoon: false, evening: false },
              wed: { morning: false, afternoon: false, evening: false },
              thu: { morning: false, afternoon: false, evening: false },
              fri: { morning: false, afternoon: false, evening: false },
              sat: { morning: false, afternoon: false, evening: false },
              sun: { morning: false, afternoon: false, evening: false }
            },
            totalQuantity: '',
            morningDose: 0,
            afternoonDose: 0,
            eveningDose: 0,
            doseCount: '0',
            slot: 1
          }
        };
      }
      
      // 스케줄이 있는 경우 기존 로직 수행
      const schedule = {
        mon: { morning: false, afternoon: false, evening: false },
        tue: { morning: false, afternoon: false, evening: false },
        wed: { morning: false, afternoon: false, evening: false },
        thu: { morning: false, afternoon: false, evening: false },
        fri: { morning: false, afternoon: false, evening: false },
        sat: { morning: false, afternoon: false, evening: false },
        sun: { morning: false, afternoon: false, evening: false }
      };
      
      // 시간대별 복용량 추출
      const timeDoses = {
        morningDose: 0,
        afternoonDose: 0,
        eveningDose: 0
      };
      
      // 조회된 스케줄 배열을 객체로 변환하고 시간대별 복용량 수집
      schedules.forEach((item: any) => {
        if (item.day_of_week && item.time_of_day) {
          schedule[item.day_of_week][item.time_of_day] = true;
          
          if (item.time_of_day === 'morning' && timeDoses.morningDose === 0) {
            timeDoses.morningDose = item.dose || 0;
          } else if (item.time_of_day === 'afternoon' && timeDoses.afternoonDose === 0) {
            timeDoses.afternoonDose = item.dose || 0;
          } else if (item.time_of_day === 'evening' && timeDoses.eveningDose === 0) {
            timeDoses.eveningDose = item.dose || 0;
          }
        }
      });
      
      return {
        data: {
          schedules: schedules,
          schedule: schedule,
          totalQuantity: slotInfo?.total?.toString() || '',
          morningDose: timeDoses.morningDose,
          afternoonDose: timeDoses.afternoonDose,
          eveningDose: timeDoses.eveningDose,
          doseCount: Math.max(timeDoses.morningDose, timeDoses.afternoonDose, timeDoses.eveningDose).toString(),
          slot: slotInfo?.slot_number || 1
        }
      };
      
    } catch (error) {
      console.error(`🚨 [MedicineController] 스케줄 조회 에러:`, error);
      
      // 에러 발생시 기본값 반환
      return {
        data: {
          schedules: [],
          schedule: {
            mon: { morning: false, afternoon: false, evening: false },
            tue: { morning: false, afternoon: false, evening: false },
            wed: { morning: false, afternoon: false, evening: false },
            thu: { morning: false, afternoon: false, evening: false },
            fri: { morning: false, afternoon: false, evening: false },
            sat: { morning: false, afternoon: false, evening: false },
            sun: { morning: false, afternoon: false, evening: false }
          },
          totalQuantity: '',
          morningDose: 0,
          afternoonDose: 0,
          eveningDose: 0,
          doseCount: '0',
          slot: 1
        }
      };
    }
  }

  /**
   * 5. 약물 상세 조회 (/api/medicine/{mediId}?userId={userId}) - 일반적인 라우트는 나중에
   */
  @Get(':mediId')
  async getMedicineDetail(
    @Param('mediId') mediId: string,
    @Query('userId') userId?: string,
    @Query('connect') connect?: string,
  ) {
    const searchUserId = userId || connect;
    
    if (!searchUserId) {
      throw new BadRequestException('사용자 ID(userId 또는 connect)가 필요합니다.');
    }

    console.log(`🔥 [MedicineController] 약물 상세 조회: mediId=${mediId}, userId=${searchUserId}`);
    return this.medicineService.getMedicineDetail(searchUserId, mediId);
  }

  /**
   * 6. 약물 등록 (/api/medicine/add) - 호환성
   */
  @Post('add')
  async addMedicine(
    @Body() body: {
      name: string;
      userId?: string;
      connect?: string;
      start_date?: string;
      end_date?: string;
      target_users?: string[];
      slot?: number;
      total?: number;
      totalQuantity?: string; // 호환성
    },
  ) {
    const userId = body.userId || body.connect;
    
    if (!userId) {
      throw new BadRequestException('사용자 ID(userId 또는 connect)가 필요합니다.');
    }
    if (!body.name) {
      throw new BadRequestException('약물명(name)이 필요합니다.');
    }

    // totalQuantity를 total로 변환 (호환성)
    const total = body.total || (body.totalQuantity ? parseInt(body.totalQuantity) : undefined);

    const medicineData = {
      name: body.name,
      start_date: body.start_date,
      end_date: body.end_date,
      target_users: body.target_users,
      slot: body.slot,
      total: total,
    };

    console.log(`🔥 [MedicineController] 약물 등록 (add):`, { userId, medicineData });
    return this.medicineService.saveMedicine(userId, medicineData);
  }

  /**
   * 7. 약물 등록 (/api/medicine) - 기본
   */
  @Post()
  async saveMedicine(
    @Body() body: {
      name: string;
      userId?: string;
      connect?: string;
      start_date?: string;
      end_date?: string;
      target_users?: string[];
      slot?: number;
      total?: number;
      totalQuantity?: string; // 호환성
    },
  ) {
    const userId = body.userId || body.connect;
    
    if (!userId) {
      throw new BadRequestException('사용자 ID(userId 또는 connect)가 필요합니다.');
    }
    if (!body.name) {
      throw new BadRequestException('약물명(name)이 필요합니다.');
    }

    // totalQuantity를 total로 변환 (호환성)
    const total = body.total || (body.totalQuantity ? parseInt(body.totalQuantity) : undefined);

    const medicineData = {
      name: body.name,
      start_date: body.start_date,
      end_date: body.end_date,
      target_users: body.target_users,
      slot: body.slot,
      total: total,
    };

    console.log(`🔥 [MedicineController] 약물 등록:`, { userId, medicineData });
    return this.medicineService.saveMedicine(userId, medicineData);
  }

  /**
   * 7. 약물 수정 (/api/medicine/{mediId})
   */
  @Put(':mediId')
  async updateMedicine(
    @Param('mediId') mediId: string,
    @Body() body: {
      name?: string;
      userId?: string;
      connect?: string;
      start_date?: string;
      end_date?: string;
      target_users?: string[];
      total?: number;
      totalQuantity?: string; // 호환성
    },
  ) {
    const userId = body.userId || body.connect;
    
    if (!userId) {
      throw new BadRequestException('사용자 ID(userId 또는 connect)가 필요합니다.');
    }

    // totalQuantity를 total로 변환 (호환성)
    const total = body.total || (body.totalQuantity ? parseInt(body.totalQuantity) : undefined);

    const updateData = {
      name: body.name,
      start_date: body.start_date,
      end_date: body.end_date,
      target_users: body.target_users,
      total: total,
    };

    console.log(`🔥 [MedicineController] 약물 수정:`, { mediId, userId, updateData });
    return this.medicineService.updateMedicine(userId, mediId, updateData);
  }

  /**
   * 8. 약물 삭제 (/api/medicine/{connect}/{mediId})
   */
  @Delete(':connect/:mediId')
  async deleteMedicine(
    @Param('connect') connect: string,
    @Param('mediId') mediId: string,
  ) {
    console.log(`🔥 [MedicineController] 약물 삭제: connect=${connect}, mediId=${mediId}`);
    return this.medicineService.deleteMedicine(connect, mediId);
  }

  /**
   * 9. 약물 수량 업데이트 (/api/medicine/quantity/{mediId}/quantity)
   */
  @Put('quantity/:mediId/quantity')
  async updateMedicineQuantity(
    @Param('mediId') mediId: string,
    @Body() body: {
      userId?: string;
      connect?: string;
      doseCount?: number;
      totalQuantity?: string;
    },
  ) {
    const userId = body.userId || body.connect;
    
    if (!userId) {
      throw new BadRequestException('사용자 ID(userId 또는 connect)가 필요합니다.');
    }

    // doseCount 또는 totalQuantity를 total로 변환
    const total = body.doseCount || (body.totalQuantity ? parseInt(body.totalQuantity) : undefined);

    if (total === undefined) {
      throw new BadRequestException('수량(doseCount 또는 totalQuantity)이 필요합니다.');
    }

    const updateData = { total };

    console.log(`🔥 [MedicineController] 약물 수량 업데이트:`, { mediId, userId, total });
    return this.medicineService.updateMedicine(userId, mediId, updateData);
  }

  /**
   * 🔥 호환성 추가: 사용자별 약물 목록 조회 (/api/medicine/user/{userId})
   */
  @Get('user/:userId')
  async getMedicineListCompatibility(@Param('userId') userId: string) {
    console.log(`🔥 [MedicineController] 호환성 - 사용자별 약물 목록 조회: userId=${userId}`);
    return this.medicineService.getMedicineList(userId);
  }

  /**
   * 🔥 프론트엔드 호환성: 약물 수정 (/api/medicine - PUT without ID)
   */
  @Put()
  async updateMedicineCompat(
    @Body() body: {
      mediId: string;
      name?: string;
      userId?: string;
      connect?: string;
      start_date?: string;
      end_date?: string;
      target_users?: string[];
      total?: number;
      totalQuantity?: string;
    },
  ) {
    if (!body.mediId) {
      throw new BadRequestException('약물 ID(mediId)가 필요합니다.');
    }
    
    const userId = body.userId || body.connect;
    if (!userId) {
      throw new BadRequestException('사용자 ID(userId 또는 connect)가 필요합니다.');
    }

    const total = body.total || (body.totalQuantity ? parseInt(body.totalQuantity) : undefined);

    const updateData = {
      name: body.name,
      start_date: body.start_date,
      end_date: body.end_date,
      target_users: body.target_users,
      total: total,
    };

    console.log(`🔥 [MedicineController] 호환성 - 약물 수정:`, { mediId: body.mediId, userId, updateData });
    return this.medicineService.updateMedicine(userId, body.mediId, updateData);
  }

  /**
   * 🔥 프론트엔드 호환성: 약물 삭제 (/api/medicine - DELETE without params)
   */
  @Delete()
  async deleteMedicineCompat(
    @Body() body: {
      connect: string;
      mediId: string;
    },
  ) {
    if (!body.connect || !body.mediId) {
      throw new BadRequestException('connect와 mediId가 필요합니다.');
    }
    
    console.log(`🔥 [MedicineController] 호환성 - 약물 삭제:`, body);
    return this.medicineService.deleteMedicine(body.connect, body.mediId);
  }

} 