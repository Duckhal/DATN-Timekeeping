import type { AuthMethod } from './enums';

export type CheckInLog = {
  log_id: bigint;
  employee_id: number;
  device_id: number;
  timestamp: Date;
  auth_method: AuthMethod;
  sync_hash: string;
};
