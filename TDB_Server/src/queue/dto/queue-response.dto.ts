import { ApiProperty } from '@nestjs/swagger';

export class QueueItem {
  @ApiProperty({ description: '슬롯 번호', example: 1 })
  slot: number;

  @ApiProperty({ description: '배출 개수', example: 1 })
  count: number;

  @ApiProperty({ description: '약품/영양제 ID', example: 'medicine_abc' })
  medi_id: string;

  @ApiProperty({ description: '약품/영양제 이름', example: '타이레놀', required: false })
  medicine?: string;

  @ApiProperty({ description: '스케줄 ID', example: 'schedule_xyz', required: false })
  scheduleId?: string;
}

export class TimePhase {
  @ApiProperty({ description: '시간대 (morning, afternoon, evening)', example: 'morning' })
  time: 'morning' | 'afternoon' | 'evening';

  @ApiProperty({ type: [QueueItem], description: '해당 시간대의 배출 아이템 목록' })
  items: QueueItem[];
}

export class BuildQueueResponseDto {
  @ApiProperty({ description: '응답 상태', example: 'ok' })
  status: string;

  @ApiProperty({ type: [TimePhase], description: '시간대별 배출 대기열' })
  queue: TimePhase[];
}