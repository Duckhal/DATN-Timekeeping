import type { Role } from './enums';

export type Employee = {
  employee_id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  date_of_birth: Date | null;
  hourly_rate: string;
  rfid_tag: string | null;
  template_fingerprint: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PublicEmployeeProfile = Omit<Employee, 'password_hash'>;
