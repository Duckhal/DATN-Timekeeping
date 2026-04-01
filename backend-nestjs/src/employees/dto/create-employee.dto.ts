import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

// Mirror Prisma's Role enum as a local constant to avoid direct Prisma client import in the DTO layer.
// Values must stay in sync with schema.prisma Role enum.
export const RoleValues = ['EMPLOYEE', 'HR'] as const;
export type RoleValue = (typeof RoleValues)[number];

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
  @IsIn(RoleValues)
  @IsOptional()
  role?: RoleValue;

  @IsNumber()
  @IsPositive()
  hourly_rate!: number;
}
