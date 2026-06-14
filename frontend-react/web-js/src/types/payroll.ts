export type PayrollEmployee = {
  employee_id: number
  email: string
  full_name: string
}

export type PayrollRecord = {
  payroll_id: number
  employee_id: number
  month_year: string
  standard_hours: string
  actual_hours: string
  hourly_rate: string
  salary_amount: string
  pdf_url: string
  published_at: string
  created_at: string
  updated_at: string
  employee: PayrollEmployee
}

export type PublishPayrollResponse = {
  month: string
  published_count: number
  records: PayrollRecord[]
}
