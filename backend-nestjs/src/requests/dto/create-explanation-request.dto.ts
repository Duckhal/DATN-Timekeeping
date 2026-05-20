import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExplanationRequestDto {
  @Type(() => Number)
  @IsInt()
  attendance_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'end_time must be HH:mm format' })
  end_time?: string;
}
