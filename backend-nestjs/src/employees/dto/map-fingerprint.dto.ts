import { IsNotEmpty, IsString } from 'class-validator';

export class MapFingerprintDto {
  @IsString()
  @IsNotEmpty()
  fingerprint_id!: string;
}
