import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/users.entity';
import { Repository } from 'typeorm';
import { DayOfWeek, Schedule } from '../schedule/entities/schedule.entity';
import { MachineSlot } from '../machine/entities/machine-slot.entity';
import { Machine } from '../machine/entities/machine.entity';
import { QueueItem, TimePhase } from './dto/queue-response.dto'; // 응답 DTO 임포트
import { TimeOfDay } from '../schedule/entities/schedule.entity'; // TimeOfDay 타입 임포트

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(MachineSlot)
    private readonly machineSlotRepository: Repository<MachineSlot>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
  ) { }

  async buildForDay(machineId: string, userId: string, day: string): Promise<TimePhase[]> {
    this.logger.log(`사용자 ${userId}의 ${day} 요일 배출 대기열 생성 중...`);

    const user = await this.userRepository.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const machine = await this.machineRepository.findOne({ where: { machine_id: machineId } });
    if (!machine) {
      throw new NotFoundException(`Machine with ID ${machineId} not found.`);
    }

    // 1. 해당 요일의 스케줄 조회
    const schedules = await this.scheduleRepository.find({
      where: {
        user_id: userId,
        day_of_week: day.toLowerCase() as DayOfWeek,
      },
      relations: ['medicine'], // medicine 정보도 함께 가져옴
    });

    // 2. 기기의 슬롯 정보 조회 (맵 생성을 위해)
    const machineSlots = await this.machineSlotRepository.find({
      where: { machine_id: machineId },
    });

    // medi_id를 slot_number로 매핑하기 위한 맵 생성
    const mediIdToSlotMap = new Map<string, number>();
    for (const slot of machineSlots) {
      if (slot.medi_id) {
        mediIdToSlotMap.set(slot.medi_id, slot.slot_number);
      }
    }

    // 3. 시간대별 phase 배열 초기화 (morning, afternoon, evening 순서 보장)
    const timePhases: TimePhase[] = [
      { time: 'morning', items: [] },
      { time: 'afternoon', items: [] },
      { time: 'evening', items: [] },
    ];

    // 4. 스케줄을 시간대별로 그룹화하여 items에 추가
    for (const schedule of schedules) {
      const slotNumber = mediIdToSlotMap.get(schedule.medi_id);

      if (slotNumber !== undefined) {
        const timePhase = timePhases.find(phase => phase.time === schedule.time_of_day);
        if (timePhase) {
          timePhase.items.push({
            slot: slotNumber,
            count: schedule.dose ?? 1,
            medi_id: schedule.medi_id,
            medicine: schedule.medicine?.name,
            scheduleId: schedule.schedule_id,
          });
        }
      } else {
        this.logger.warn(`[QueueService] 스케줄(ID: ${schedule.schedule_id})의 약(${schedule.medi_id})이 기기(${machineId})의 슬롯에 없습니다. 건너뜁니다.`);
      }
    }

    return timePhases; // 최종적으로 시간대별 그룹화된 배열을 반환
  }
}
