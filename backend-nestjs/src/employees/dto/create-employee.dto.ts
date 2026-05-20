import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ROLE_VALUES } from '../../types';
import type { Role } from '../../types';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsIn(ROLE_VALUES)
  @IsOptional()
  role?: Role;

  @IsNumber()
  @IsPositive()
  hourly_rate!: number;

  @IsString()
  @IsOptional()
  date_of_birth?: string;
}
