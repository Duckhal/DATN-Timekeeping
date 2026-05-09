import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SyncMappingCallbackDto {
  @IsString()
  @IsNotEmpty()
  mac_addr!: string;

  @IsInt()
  @Min(1)
  employee_id!: number;

  @IsInt()
  @Min(1)
  fingerprint_id!: number;
}
