import { Controller, Post, Body, UseGuards, Logger, ValidationPipe } from '@nestjs/common';
import { RfidService } from './rfid.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

class RfidResolveDto {
  @IsString()
  @IsNotEmpty()
  uid: string;
}

@ApiTags('디바이스 API')
@Controller('rfid')
//@UseGuards(AccessTokenGuard)
export class RfidController {
  private readonly logger = new Logger(RfidController.name);

  constructor(private readonly rfidService: RfidService) {}

  @Post('resolve')
  @ApiOperation({ summary: 'RFID UID로 사용자 식별 (신규)' })
  @ApiBearerAuth()
  async resolveRfid(@Body(ValidationPipe) body: RfidResolveDto) {
    this.logger.log(`[Device API] RFID Resolve 요청: ${body.uid}`);
    return this.rfidService.resolveRfid(body.uid);
  }
}
