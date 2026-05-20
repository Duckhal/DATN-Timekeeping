import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateOtRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
