import { IsInt, Min } from 'class-validator';

export class StartFingerprintEnrollDto {
  @IsInt()
  @Min(1)
  device_id!: number;
}
