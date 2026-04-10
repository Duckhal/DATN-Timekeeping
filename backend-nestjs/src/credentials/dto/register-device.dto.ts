import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  mac_addr!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}
