import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CheckinDto {
  @IsString()
  @IsNotEmpty()
  mac_addr!: string;

  @IsInt()
  @Min(1)
  fingerprint_id!: number;

  /**
   * Client-generated idempotency token (e.g. UUID v4). Retries from firmware
   * with the same `client_tx_id` must not create duplicate CheckInLog rows.
   */
  @IsString()
  @IsNotEmpty()
  client_tx_id!: string;
}
