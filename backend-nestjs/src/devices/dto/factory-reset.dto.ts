import { IsNotEmpty, IsString } from 'class-validator';

export class FactoryResetDto {
  @IsString()
  @IsNotEmpty()
  mac_addr!: string;
}
