import { IsNotEmpty, IsString } from 'class-validator';

export class FingerprintCallbackDto {
  @IsString()
  @IsNotEmpty()
  mac_addr!: string;

  @IsString()
  @IsNotEmpty()
  fingerprint_id!: string;

  @IsString()
  template_data!: string;
}
