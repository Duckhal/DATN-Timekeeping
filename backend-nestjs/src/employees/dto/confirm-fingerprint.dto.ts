import { IsInt, Min } from 'class-validator';

export class ConfirmFingerprintDto {
  @IsInt()
  @Min(1)
  device_id!: number;
}
