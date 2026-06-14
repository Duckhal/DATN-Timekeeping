import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateEmployeeDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  full_name?: string;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsDateString()
  @IsOptional()
  date_of_birth?: string | null;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  hourly_rate?: number;
}
