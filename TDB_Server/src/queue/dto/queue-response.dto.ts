import { ApiProperty } from '@nestjs/swagger';

// 스키마에 명시된 QueueItem 인터페이스를 클래스로 구현
export class QueueItem {
  @ApiProperty({ example: 1, description: 'Slot number in the machine' })
  slot: number;

  @ApiProperty({ example: 2, description: 'Number of pills to dispense' })
  count: number;

  @ApiProperty({ required: false, example: '비타민C', description: 'Name of the medicine' })
  medicine?: string;

  @ApiProperty({ required: false, example: 'schedule-123', description: 'ID of the schedule item' })
  scheduleId?: string;

  @ApiProperty({ required: false, example: 'medicine-123', description: 'ID of the medicine' })
  medi_id: string;
}

// 스키마에 명시된 BuildQueueOut 인터페이스를 클래스로 구현
export class BuildQueueResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ type: [QueueItem] })
  queue: QueueItem[];
}
