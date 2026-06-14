export type PayrollActor = {
  employee_id: number;
  role: 'MANAGER' | 'EMPLOYEE';
};

export type PayrollEmployee = {
  employee_id: number;
  email: string;
  full_name: string;
  hourly_rate: unknown;
};

export type PayrollAttendanceRow = {
  employee_id: number;
  date: Date;
  checkin_time: Date | null;
  checkout_time: Date | null;
};

export type PayrollAmounts = {
  standardHours: number;
  actualHours: number;
  hourlyRate: number;
  salaryAmount: number;
};

export type PayrollRecordWithEmployee = {
  payroll_id: number;
  employee_id: number;
  month_year: string;
  standard_hours: unknown;
  actual_hours: unknown;
  hourly_rate: unknown;
  salary_amount: unknown;
  pdf_path: string;
  published_at: Date;
  created_at: Date;
  updated_at: Date;
  employee: {
    employee_id: number;
    email: string;
    full_name: string;
  };
};
