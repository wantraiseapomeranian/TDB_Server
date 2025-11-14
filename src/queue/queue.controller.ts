import { Controller, Post, Body, UseGuards, Logger, ValidationPipe } from '@nestjs/common';
import { QueueService } from './queue.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { BuildQueueDto } from './dto/build-queue.dto'; // Import the new DTO
import { BuildQueueResponseDto } from './dto/queue-response.dto';

// Utility functions for weekday inference
function inferWeekday(client_ts?: number, tz_offset_min?: number): string | undefined {
  if (!client_ts || typeof tz_offset_min === 'undefined') return;
  const ms = (client_ts * 1000) + (tz_offset_min * 60 * 1000);
  const d  = new Date(ms);
  return ['sun','mon','tue','wed','thu','fri','sat'][d.getUTCDay()];
}

function serverLocalWeekday(): string {
  return ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
}

@ApiTags('디바이스 API')
@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueService: QueueService) {}

  @Post('build')
  @ApiOperation({ summary: '배출 대기열 생성 (요일 필터 포함)' })
  @ApiBearerAuth()
  // Swagger를 위한 응답 스키마 정의 추가
  @ApiResponse({ status: 201, description: '성공', type: BuildQueueResponseDto })
  async buildQueue(@Body(ValidationPipe) dto: BuildQueueDto): Promise<BuildQueueResponseDto> {
    this.logger.log(`[Device API] Queue Build 요청: user ${dto.user_id} for machine ${dto.machine_id}`);

    const day = dto.weekday?.toLowerCase()
      ?? inferWeekday(dto.client_ts, dto.tz_offset_min)
      ?? serverLocalWeekday();

    // 서비스는 이제 데이터 배열만 반환합니다.
    const queueData = await this.queueService.buildForDay(dto.machine_id, dto.user_id, day);
    
    // 컨트롤러에서 최종 응답 객체를 만듭니다.
    return { status: 'ok', queue: queueData };
  }
}
