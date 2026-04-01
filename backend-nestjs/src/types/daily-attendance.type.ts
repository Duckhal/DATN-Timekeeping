import type { CalcStatus } from './enums';

export type DailyAttendance = {
  attendance_id: bigint;
  employee_id: number;
  date: Date;
  checkin_time: Date | null;
  checkout_time: Date | null;
  missing_minutes: number;
  total_workday: string;
  status: CalcStatus;
};
