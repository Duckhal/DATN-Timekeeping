import { IsNotEmpty, IsString } from 'class-validator';

export class AssignRfidDto {
  @IsString()
  @IsNotEmpty()
  rfid_tag!: string;
}
