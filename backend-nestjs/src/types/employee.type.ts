import type { Role } from './enums';

export type Employee = {
  employee_id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  date_of_birth: Date;
  hourly_rate: string;
  rfid_tag: string | null;
  fingerprint_id: string | null;
};

export type PublicEmployeeProfile = Omit<Employee, 'password_hash'>;
