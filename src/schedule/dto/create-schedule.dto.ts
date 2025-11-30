import { IsObject, IsOptional, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// 시간대별 체크 여부 (true/false)
export class DailyScheduleDto {
  @IsOptional()
  morning?: boolean;

  @IsOptional()
  afternoon?: boolean;

  @IsOptional()
  evening?: boolean;
}

// 요일별 스케줄
export class WeekScheduleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DailyScheduleDto)
  mon?: DailyScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyScheduleDto)
  tue?: DailyScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyScheduleDto)
  wed?: DailyScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyScheduleDto)
  thu?: DailyScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyScheduleDto)
  fri?: DailyScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyScheduleDto)
  sat?: DailyScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyScheduleDto)
  sun?: DailyScheduleDto;
}

export class CreateMedicineScheduleDto {
  @IsOptional()
  @IsString()
  memberId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WeekScheduleDto)
  schedule: WeekScheduleDto;

  @IsOptional()
  @IsNumber()
  morningDose?: number;

  @IsOptional()
  @IsNumber()
  afternoonDose?: number;

  @IsOptional()
  @IsNumber()
  eveningDose?: number;

  @IsOptional()
  @IsString()
  requestUserId?: string;

  @IsOptional()
  @IsString()
  totalQuantity?: string;

  @IsOptional()
  @IsString()
  doseCount?: string; // 호환성을 위해 유지
}
