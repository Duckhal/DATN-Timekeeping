import { IsIn } from 'class-validator';
import { AUTH_METHOD_VALUES } from '../../types';
import type { AuthMethod } from '../../types';

export class RemoveCredentialsDto {
  @IsIn(AUTH_METHOD_VALUES)
  type!: AuthMethod;
}
