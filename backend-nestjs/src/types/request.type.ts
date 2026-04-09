import type { RequestStatus, RequestType } from './enums';

export type Request = {
  request_id: number;
  employee_id: number;
  attendance_id: bigint | null;
  type: RequestType;
  status: RequestStatus;
  date: Date;
  start_time: Date | null;
  end_time: Date | null;
  created_at: Date;
  updated_at: Date;
};
