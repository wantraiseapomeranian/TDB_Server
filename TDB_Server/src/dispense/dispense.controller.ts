import { Controller, Post, Body, UseGuards, Logger, ValidationPipe } from '@nestjs/common';
import { DispenseService, DispenseReportDto } from './dispense.service';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('디바이스 API')
@Controller('dispense')
//@UseGuards(AccessTokenGuard)
export class DispenseController {
  private readonly logger = new Logger(DispenseController.name);

  constructor(private readonly dispenseService: DispenseService) {}

  @Post('report')
  @ApiOperation({ summary: '배출 결과 보고 (신규)' })
  @ApiBearerAuth()
  async reportDispense(@Body(ValidationPipe) body: DispenseReportDto) {
    this.logger.log(`[Device API] Dispense Report 수신: user ${body.user_id}, time ${body.time}, result ${body.result}`);
    return this.dispenseService.reportDispense(body);
  }
}
