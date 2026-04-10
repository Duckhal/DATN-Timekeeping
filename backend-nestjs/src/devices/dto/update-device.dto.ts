import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DEVICE_STATUS_VALUES } from '../../types';
import type { DeviceStatus } from '../../types';

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(DEVICE_STATUS_VALUES)
  status?: DeviceStatus;
}
