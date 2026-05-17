import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { AUTH_METHOD_VALUES } from '../../types/enums';

export class CheckinDto {
  @IsString()
  @IsNotEmpty()
  mac_addr!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(AUTH_METHOD_VALUES)
  auth_method!: 'RFID' | 'FINGERPRINT';

  @ValidateIf((o) => o.auth_method === 'FINGERPRINT')
  @IsInt()
  @Min(1)
  fingerprint_id?: number;

  @ValidateIf((o) => o.auth_method === 'RFID')
  @IsString()
  @IsNotEmpty()
  rfid_tag?: string;

  /**
   * Client-generated idempotency token (e.g. UUID v4). Retries from firmware
   * with the same `client_tx_id` must not create duplicate CheckInLog rows.
   */
  @IsString()
  @IsNotEmpty()
  client_tx_id!: string;
}
