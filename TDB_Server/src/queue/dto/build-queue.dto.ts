import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class BuildQueueDto {
  @ApiProperty({ description: 'The ID of the machine' })
  @IsString()
  @IsNotEmpty()
  machine_id: string;

  @ApiProperty({ description: 'The ID of the user' })
  @IsString() // 또는 @IsNumber() - user_id 타입에 맞게 조정
  @IsNotEmpty()
  user_id: string;

  @ApiPropertyOptional({ description: 'Specific day of the week (e.g., "mon", "tue")' })
  @IsString()
  @IsOptional()
  weekday?: string;

  @ApiPropertyOptional({ description: 'Client timestamp (Unix seconds)' })
  @IsNumber()
  @IsOptional()
  client_ts?: number;

  @ApiPropertyOptional({ description: 'Timezone offset from UTC in minutes' })
  @IsNumber()
  @IsOptional()
  tz_offset_min?: number;
}
