import { Controller, Post, Body, UseGuards, Logger, ValidationPipe, Req, UnauthorizedException } from '@nestjs/common';
import { DeviceService } from './device.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

class DeviceEventDto {
  @IsString()
  @IsNotEmpty()
  machine_id: string;

  @IsString()
  @IsNotEmpty()
  level: 'INFO' | 'WARN' | 'ERROR';

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  ts: string;

  @IsObject()
  @IsOptional()
  extra?: Record<string, any>;
}

@ApiTags('디바이스 API')
@Controller('device')
//@UseGuards(AccessTokenGuard)
export class DeviceController {
  private readonly logger = new Logger(DeviceController.name);

  constructor(private readonly deviceService: DeviceService) {}

  @Post('event')
  @ApiOperation({ summary: '디바이스 로그/이벤트 업로드 (신규)' })
  @ApiBearerAuth()
  async logDeviceEvent(@Body(ValidationPipe) body: DeviceEventDto, @Req() req) {
    // 인증된 기기(토큰의 주체)와 이벤트의 주체가 동일한지 확인
    if (req.user.id !== body.machine_id) {
        this.logger.warn(`[Device Event] Token machine_id (${req.user.id}) does not match body machine_id (${body.machine_id}).`);
        throw new UnauthorizedException('토큰과 요청 본문의 기기 ID가 일치하지 않습니다.');
    }
    this.logger.log(`[Device API] Event received from: ${body.machine_id}`);
    return this.deviceService.logEvent(body);
  }
}
