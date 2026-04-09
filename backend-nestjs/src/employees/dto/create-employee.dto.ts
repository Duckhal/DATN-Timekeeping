import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { ROLE_VALUES } from '../../types';
import type { Role } from '../../types';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  full_name!: string;

  // Defaults to EMPLOYEE in Prisma schema if omitted
  @IsIn(ROLE_VALUES)
  @IsOptional()
  role?: Role;

  @IsNumber()
  @IsPositive()
  hourly_rate!: number;
}
