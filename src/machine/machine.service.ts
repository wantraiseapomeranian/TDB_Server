import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, Like } from 'typeorm';
import { User } from '../users/entities/users.entity';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Medicine } from '../shared/entities/medicine.entity';
import { Machine } from './entities/machine.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { UserRole } from '../users/entities/user-role.enum';

@Injectable()
export class MachineService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(UserGroupMembership)
    private membershipRepository: Repository<UserGroupMembership>,

    @InjectRepository(Schedule)
    private scheduleRepository: Repository<Schedule>,

    @InjectRepository(Medicine)
    private medicineRepository: Repository<Medicine>,

    @InjectRepository(Machine)
    private machineRepository: Repository<Machine>,

    @InjectRepository(MachineSlot)
    private machineSlotRepository: Repository<MachineSlot>,
  ) {}

  // 사용자의 그룹 정보 조회 헬퍼 메서드
  private async getUserGroup(userId: string) {
    const membership = await this.membershipRepository.findOne({
      where: { user_id: userId },
      relations: ['group']
    });

    if (!membership) {
      throw new NotFoundException('사용자의 그룹 정보를 찾을 수 없습니다.');
    }

    return { membership, group_id: membership.group_id };
  }

  async findAllUsers(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findAllMedicine(): Promise<Medicine[]> {
    return this.medicineRepository.find();
  }

  async findAllSchedule(): Promise<Schedule[]> {
    return this.scheduleRepository.find();
  }

  async findAllMachine(): Promise<Machine[]> {
    return this.machineRepository.find();
  }

  // QR 코드 검증 (uid 기반)
  async verifyUid(
    uid: string,
  ): Promise<
    | { confirmed: true; type: 'kit'; user: User }
    | { confirmed: true; type: 'machine'; machine_id: string }
    | { confirmed: false; type: 'unknown'; uid: string; qr_data: string }
  > {
    // 사용자 QR 코드인지 확인
    const user = await this.userRepository.findOne({
      where: { k_uid: uid },
    });

    if (user) {
      return { confirmed: true, type: 'kit', user };
    }

    // 기기 QR 코드인지 확인
    const machine = await this.machineRepository.findOne({
      where: { machine_id: uid },
    });

    if (machine) {
      return { confirmed: true, type: 'machine', machine_id: machine.machine_id };
    }

    return { confirmed: false, type: 'unknown', uid, qr_data: uid };
  }

  async findUserByUid(uid: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { k_uid: uid } });
  }

  async getTodayScheduleByUid(uid: string) {
    const user = await this.findUserByUid(uid);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const { group_id } = await this.getUserGroup(user.user_id);

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekday = days[new Date().getDay()];

    const schedules = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.medicine', 'medicine')
      .where('schedule.group_id = :group_id', { group_id })
      .andWhere('schedule.user_id = :user_id', { user_id: user.user_id })
      .andWhere('FIND_IN_SET(:day, schedule.day_of_week)', { day: weekday })
      .getMany();

    const timeMap: Record<
      'morning' | 'afternoon' | 'evening',
      { medi_id: string; dose: number }[]
    > = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const sched of schedules) {
      if (sched.time_of_day && sched.dose > 0) {
        timeMap[sched.time_of_day]?.push({
          medi_id: sched.medi_id,
          dose: sched.dose,
        });
      }
    }

    return {
      status: 'ok',
      weekday,
      schedule: timeMap,
    };
  }

  async getMedicineRemainByMachine(machine_id: string) {
    // 기기 정보와 그룹 ID를 함께 조회
    const machine = await this.machineRepository.findOne({
      where: { machine_id },
    });

    if (!machine) {
      throw new NotFoundException(`Machine with ID ${machine_id} not found`);
    }
    const group_id = machine.group_id;

    // 기기의 슬롯 정보 조회
    const machineSlots = await this.machineSlotRepository.find({
      where: { machine_id },
      order: { slot_number: 'ASC' },
    });

    const medicineIds = machineSlots
      .map((slot) => slot.medi_id)
      .filter((id): id is string => id !== null && !id.startsWith('TEMP_'));

    if (medicineIds.length === 0) {
      // 조회할 약이 없으면 바로 반환
      return machineSlots.map((slot) => ({
        slot_number: slot.slot_number,
        medi_id: slot.medi_id,
        name: '(약 미등록)',
        total: slot.total,
        remain: slot.remain,
      }));
    }
       
    const medicines = await this.medicineRepository.findBy({
      medi_id: In(medicineIds),
      group_id: group_id, // ★★★ group_id 조건 추가
    });

    const medicineMap = new Map(medicines.map((m) => [m.medi_id, m]));

    return machineSlots.map((slot) => ({
      slot_number: slot.slot_number,
      medi_id: slot.medi_id,
      name: slot.medi_id && !slot.medi_id.startsWith('TEMP_') 
        ? medicineMap.get(slot.medi_id)?.name ?? '(이름 없음)' 
        : '(약 미등록)',
      total: slot.total,
      remain: slot.remain,
    }));
  }

  async getUsersByMachineId(machine_id: string) {
    // 기기의 그룹 정보 조회
    const machine = await this.machineRepository.findOne({
      where: { machine_id },
      relations: ['group']
    });

    if (!machine) {
      throw new NotFoundException('기기를 찾을 수 없습니다.');
    }

    // 해당 그룹의 모든 구성원 조회
    const memberships = await this.membershipRepository.find({
      where: { group_id: machine.group_id },
      relations: ['user']
    });

    return memberships.map(membership => ({
      user_id: membership.user.user_id,
      name: membership.user.name,
      role: membership.role,
    }));
  }

  async getSchedulesByMachineAndDate(machine_id: string, date: string) {
    const dayOfWeek = new Date(date)
      .toLocaleString('en-US', { weekday: 'short' })
      .toLowerCase();

    // 기기의 그룹 정보 조회
    const machine = await this.machineRepository.findOne({
      where: { machine_id },
      relations: ['group']
    });

    if (!machine) {
      return [];
    }

    const schedules = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.user', 'user')
      .leftJoinAndSelect('schedule.medicine', 'medicine')
      .where('schedule.group_id = :group_id', { group_id: machine.group_id })
      .andWhere('FIND_IN_SET(:day, schedule.day_of_week)', { day: dayOfWeek })
      .getMany();

    return schedules.map((s) => ({
      user_id: s.user?.user_id,
      user_name: s.user?.name,
      medi_id: s.medi_id,
      medicine_name: s.medicine?.name,
      time_of_day: s.time_of_day,
      dose: s.dose,
    }));
  }

  // 🔥 그룹 기반 가족 기기 상태 조회
  async getMachineStatusByGroupId(group_id: string) {
    try {
      // 해당 그룹의 가족 구성원들 조회
      const memberships = await this.membershipRepository.find({
        where: { group_id },
        relations: ['user']
      });

      if (!memberships.length) {
        return {
          connectedDevices: 0,
          totalDevices: 0,
          machineStatus: [],
          lastUpdated: new Date().toISOString()
        };
      }

      // 해당 그룹의 기기들 조회
      const machines = await this.machineRepository.find({
        where: { group_id }
      });

      if (!machines.length) {
        // 기기가 등록되지 않은 경우 기본 상태 반환
        return {
          connectedDevices: 0,
          totalDevices: 0,
          machineStatus: [{
            machine_id: 'NONE',
            isConnected: false,
            totalSlots: 0,
            activeSlots: 0,
            lowStockSlots: 0,
            users: memberships.map(membership => ({
              user_id: membership.user.user_id,
              name: membership.user.name,
              role: membership.role
            })),
            medicineSlots: []
          }],
          lastUpdated: new Date().toISOString()
        };
      }

      // 각 기기의 상세 정보 조회
      const machineStatusPromises = machines.map(async (machine) => {
        // 기기의 약물 잔여량 정보
        const medicineRemain = await this.getMedicineRemainByMachine(machine.machine_id);
        
        // 전체 약물 슬롯 수와 활성 슬롯 수 계산
        const totalSlots = medicineRemain.length;
        const activeSlots = medicineRemain.filter(slot => 
          slot.medi_id && !slot.medi_id.startsWith('TEMP_') && slot.remain > 0
        ).length;
        const lowStockSlots = medicineRemain.filter(slot => 
          slot.remain > 0 && slot.remain < 5
        ).length;

        // 실제 기기 연결 상태 확인
        const isConnected = machine && 
                           totalSlots > 0 && 
                           memberships.length > 0;

        return {
          machine_id: machine.machine_id,
          isConnected,
          totalSlots,
          activeSlots,
          lowStockSlots,
          users: memberships.map(membership => ({
            user_id: membership.user.user_id,
            name: membership.user.name,
            role: membership.role
          })),
          medicineSlots: medicineRemain
        };
      });

      const machineStatusList = await Promise.all(machineStatusPromises);
      const connectedDevices = machineStatusList.filter(status => status.isConnected).length;

      return {
        connectedDevices,
        totalDevices: machines.length,
        machineStatus: machineStatusList,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('그룹 기기 상태 조회 오류:', error);
      return {
        connectedDevices: 0,
        totalDevices: 0,
        machineStatus: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // 기기 목록 조회
  async getMachines(): Promise<Machine[]> {
    return this.machineRepository.find();
  }

  // 기기 상태 조회
  async getMachineStatus(machine_id: string) {
    console.log(`🔍 [MachineService] 기기 상태 조회: machine_id=${machine_id}`);
    
    // TODO: 실제 기기 상태 조회 로직 구현
    return {
      success: true,
      data: {
        machine_id,
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        message: '기기 상태 조회 API는 추가 구현이 필요합니다.'
      }
    };
  }

  // 기기 정보 업데이트
  async updateMachine(id: string, updateData: any) {
    console.log(`🔍 [MachineService] 기기 업데이트: id=${id}`, updateData);
    
    try {
      // Machine 테이블에서 해당 기기 찾기
      const machine = await this.machineRepository.findOne({ where: { machine_id: id } });
      
      if (!machine) {
        throw new NotFoundException('기기를 찾을 수 없습니다.');
      }

      // 업데이트 가능한 필드들만 처리
      const updatedMachine = await this.machineRepository.save({
        ...machine,
        ...updateData,
        machine_id: id, // ID는 변경되지 않도록 보장
      });

      return {
        success: true,
        data: updatedMachine,
        message: '기기 정보가 업데이트되었습니다.'
      };
    } catch (error) {
      console.error('기기 업데이트 실패:', error);
      return {
        success: false,
        error: { message: error.message || '기기 업데이트에 실패했습니다.' }
      };
    }
  }

  // 기기 슬롯 업데이트
  async updateSlots(machine_id: string, slotData: any) {
    console.log(`🔍 [MachineService] 슬롯 업데이트: machine_id=${machine_id}`, slotData);
    
    // TODO: 실제 슬롯 업데이트 로직 구현
    return {
      success: true,
      data: {
        machine_id,
        updated_slots: slotData,
        message: '슬롯 업데이트 API는 추가 구현이 필요합니다.'
      }
    };
  }

  /**
   * 공통 슬롯 할당 로직 - 의약품과 영양제 모두 사용
   */
  async assignSlot(groupId: string, requestedSlot?: number): Promise<{ success: boolean; slot?: number; error?: string }> {
    try {
      // 해당 그룹의 기기 조회
      const machines = await this.machineRepository.find({
        where: { group_id: groupId }
      });

      if (machines.length === 0) {
        return { success: false, error: '등록된 디스펜서가 없습니다.' };
      }

      const machine = machines[0]; // 첫 번째 기기 사용
      
      // 현재 사용 중인 모든 슬롯 조회 (의약품 + 영양제)
      const usedSlots = await this.machineSlotRepository.find({
        where: { machine_id: machine.machine_id },
        select: ['slot_number']
      });
      
      const usedSlotNumbers = usedSlots.map(slot => slot.slot_number);
      
      console.log(`🎯 [MachineService] 그룹 ${groupId} 슬롯 할당 요청:`);
      console.log(`🎯 기기: ${machine.machine_id}, 최대 슬롯: ${machine.max_slot}`);
      console.log(`🎯 현재 사용 중인 슬롯: [${usedSlotNumbers.join(', ')}]`);
      console.log(`🎯 요청된 슬롯: ${requestedSlot || '자동'}`);

      // 요청된 슬롯이 있고 사용 가능한 경우
      if (requestedSlot && requestedSlot >= 1 && requestedSlot <= machine.max_slot && !usedSlotNumbers.includes(requestedSlot)) {
        console.log(`🎯 요청된 슬롯 ${requestedSlot}번 사용 가능 - 할당`);
        return { success: true, slot: requestedSlot };
      }

      // 자동 할당: 1번부터 순차적으로 비어있는 슬롯 찾기
      let targetSlot = 1;
      while (usedSlotNumbers.includes(targetSlot) && targetSlot <= machine.max_slot) {
        targetSlot++;
      }

      if (targetSlot > machine.max_slot) {
        return { 
          success: false, 
          error: `사용 가능한 슬롯이 없습니다. (최대 ${machine.max_slot}개, 현재 사용 중: ${usedSlotNumbers.length}개)` 
        };
      }

      console.log(`🎯 자동 할당: ${targetSlot}번 슬롯`);
      return { success: true, slot: targetSlot };

    } catch (error) {
      console.error('🔥 [MachineService] 슬롯 할당 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '슬롯 할당 실패' 
      };
    }
  }

  /**
   * 슬롯 예약 (실제 MachineSlot 레코드 생성)
   */
  async reserveSlot(groupId: string, mediId: string, slotNumber: number, total: number): Promise<{ success: boolean; error?: string }> {
    try {
      // 해당 그룹의 기기 조회
      const machines = await this.machineRepository.find({
        where: { group_id: groupId }
      });

      if (machines.length === 0) {
        return { success: false, error: '등록된 디스펜서가 없습니다.' };
      }

      const machine = machines[0];

      // 슬롯이 이미 사용 중인지 다시 한 번 확인 (동시성 문제 방지)
      const existingSlot = await this.machineSlotRepository.findOne({
        where: { 
          machine_id: machine.machine_id, 
          slot_number: slotNumber 
        }
      });

      if (existingSlot) {
        return { 
          success: false, 
          error: `슬롯 ${slotNumber}번이 이미 사용 중입니다. (${existingSlot.medi_id})` 
        };
      }

      // 새 슬롯 레코드 생성
      const machineSlot = this.machineSlotRepository.create({
        machine_id: machine.machine_id,
        slot_number: slotNumber,
        medi_id: mediId,
        total: total,
        remain: total
      });

      await this.machineSlotRepository.save(machineSlot);

      console.log(`🎯 [MachineService] 슬롯 예약 완료: ${mediId} → ${machine.machine_id} 슬롯 ${slotNumber}번`);
      return { success: true };

    } catch (error) {
      console.error('🔥 [MachineService] 슬롯 예약 오류:', error);
      
      // Primary Key 제약 위반 체크
      if (error instanceof Error && error.message.includes('PRIMARY')) {
        return { 
          success: false, 
          error: `슬롯 ${slotNumber}번이 이미 사용 중입니다. (동시 접근으로 인한 충돌)` 
        };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '슬롯 예약 실패' 
      };
    }
  }

  /**
   * 슬롯 총량 업데이트 (영양제 및 의약품 총량 변경용)
   */
  async updateSlotQuantity(groupId: string, mediId: string, totalQuantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      // 해당 그룹의 기기 조회
      const machines = await this.machineRepository.find({
        where: { group_id: groupId }
      });

      if (machines.length === 0) {
        return { success: false, error: '등록된 디스펜서가 없습니다.' };
      }

      const machine = machines[0];

      // 해당 mediId로 슬롯 조회
      const machineSlot = await this.machineSlotRepository.findOne({
        where: { 
          machine_id: machine.machine_id,
          medi_id: mediId
        }
      });

      if (!machineSlot) {
        return { 
          success: false, 
          error: `${mediId}에 해당하는 슬롯을 찾을 수 없습니다.` 
        };
      }

      // 총량 업데이트 (잔여량도 비례적으로 조정)
      const remainRatio = machineSlot.total > 0 ? machineSlot.remain / machineSlot.total : 1;
      const newRemain = Math.round(totalQuantity * remainRatio);

      await this.machineSlotRepository.update(
        { 
          machine_id: machine.machine_id,
          medi_id: mediId
        },
        {
          total: totalQuantity,
          remain: newRemain
        }
      );

      console.log(`🎯 [MachineService] 슬롯 총량 업데이트: ${mediId} → 총 ${totalQuantity}개, 잔여 ${newRemain}개 (슬롯 ${machineSlot.slot_number}번)`);
      return { success: true };

    } catch (error) {
      console.error('🔥 [MachineService] 슬롯 총량 업데이트 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '슬롯 총량 업데이트 실패' 
      };
    }
  }

  // ===================================================================
  // 🔥 TDB-Client GUI 연동 API
  // ===================================================================

  // 오늘의 전체 스케줄 조회
  async getTodaySchedulesForMachine(machine_id: string): Promise<any> {
    const machine = await this.machineRepository.findOne({ where: { machine_id } });
    if (!machine) {
      throw new NotFoundException(`Machine with ID ${machine_id} not found`);
    }
    const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
    const schedules = await this.scheduleRepository.find({
      where: {
        group_id: machine.group_id,
        day_of_week: Like(`%${weekday}%`) as any,
      },
      relations: ['user', 'medicine'],
      order: { time_of_day: 'ASC' },
    });
    return schedules.map(s => ({
      time_of_day: s.time_of_day,
      user_name: s.user.name,
      medicine_name: s.medicine.name,
      dose: s.dose, 
    }));
  }

  // 최근 배출 기록 조회
  async getDoseHistoryForMachine(machine_id: string, limit: number): Promise<any> {
    // DoseHistory 엔티티와 Repository가 필요합니다.
    // 아래는 DoseHistoryRepository가 주입되었다고 가정한 예시 코드입니다.
    // (실제로는 dose-history.service.ts 에 구현하는 것이 더 적합합니다.)
      /*
    return this.doseHistoryRepository.find({
      where: { machine_id },
      relations: ['user'],
      order: { dispensed_at: 'DESC' },
      take: limit,
    });
    */
      // 임시 응답 (DoseHistory 모듈이 없으므로)
    console.warn(`getDoseHistoryForMachine is returning mock data for machine ${machine_id}.`);
    return [
      { dispensed_at: new Date().toISOString(), user_name: "김경동 (mock)", result: "completed" },
      { dispensed_at: new Date().toISOString(), user_name: "강현성 (mock)", result: "failed" },
    ].slice(0, limit);
  }

  // ===================================================================
  // 🔥 디바이스 API (새로운 명세)
  // ===================================================================

  async checkMachine(machineId: string): Promise<{ registered: boolean; register_url?: string }> {
    console.log(`[Device API] Checking registration for machine: ${machineId}`);
    const machine = await this.machineRepository.findOne({
      where: { machine_id: machineId },
    });

    if (!machine) {
      console.warn(`[Device API] Machine ${machineId} is not registered.`);
      return { 
        registered: false,
        // 필요 시 등록 페이지 URL 제공
        // register_url: `https://app.example.com/machine/register?mid=${machineId}`
      };
    }

    console.log(`[Device API] Machine ${machineId} is registered.`);
    return { registered: true };
  }

  async recordHeartbeat(body: { machine_id: string; status?: string; ts?: number }): Promise<{ status: string }> {
    console.log(`[Device API] Heartbeat received from ${body.machine_id}, status: ${body.status}`);
    // TODO: 수신된 하트비트 정보를 DB에 기록 (예: last_seen 업데이트)하여 기기 온라인 상태를 모니터링할 수 있습니다.
    // 이를 위해 machine 엔티티에 last_seen 같은 컬럼 추가가 필요합니다.
    
    const machine = await this.machineRepository.findOne({ where: { machine_id: body.machine_id }});
    if (!machine) {
      console.error(`[Device API] Heartbeat from unregistered machine: ${body.machine_id}`);
      throw new NotFoundException(`${body.machine_id}는 등록되지 않은 기기입니다.`);
    }
    
    return { status: "ok" };
  }

  async getMachineConfig(machineId: string): Promise<any> {
    console.log(`[Device API] Fetching config for machine: ${machineId}`);
    // TODO: 기기별 설정을 DB에 저장하고, 해당 기기의 설정을 동적으로 반환하도록 개선할 수 있습니다.
    const machine = await this.machineRepository.findOne({ where: { machine_id: machineId }});
    if (!machine) {
      console.error(`[Device API] Config request for unregistered machine: ${machineId}`);
      throw new NotFoundException(`${machineId}는 등록되지 않은 기기입니다.`);
    }

    const config = {
      "tz": "Asia/Seoul",
      "dispense_retry": 1,
      "cooldown_sec": 2.0,
      "dry_run": false
    };
    console.debug(`[Device API] Returning config for ${machineId}: ${JSON.stringify(config)}`);
    return config;
  }
}
