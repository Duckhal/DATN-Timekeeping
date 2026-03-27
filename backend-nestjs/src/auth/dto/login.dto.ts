import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  account_username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
