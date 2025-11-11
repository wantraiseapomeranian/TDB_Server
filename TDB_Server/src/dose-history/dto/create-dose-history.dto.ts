import { IsString, IsOptional, IsInt, IsEnum, IsDateString } from 'class-validator';

export class CreateDoseHistoryDto {
  @IsString()
  connect: string;

  @IsString()
  userId: string;

  @IsString()
  mediId: string;

  @IsEnum(['morning', 'afternoon', 'evening'])
  timeOfDay: 'morning' | 'afternoon' | 'evening';

  @IsDateString()
  doseDate: Date;

  @IsInt()
  scheduledDose: number;

  @IsInt()
  actualDose: number;

  @IsEnum(['completed', 'missed', 'partial'])
  status: 'completed' | 'missed' | 'partial';

  @IsOptional()
  @IsDateString()
  completedAt?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
} 