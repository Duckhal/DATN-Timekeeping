export type EmployeeManager = {
  employee_id: number
  email: string
  full_name: string
}

export type Employee = {
  employee_id: number
  email: string
  full_name: string
  role: 'HR' | 'EMPLOYEE'
  date_of_birth: string | null
  hourly_rate: string
  rfid_tag: string | null
  template_fingerprint: string | null
  must_change_password: boolean
  manager_id: number | null
  manager?: EmployeeManager | null
  created_at?: string
  updated_at?: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  must_change_password?: boolean
  user: Employee | { employee_id: number; full_name: string }
}

export type ChangePasswordRequest = {
  current_password: string
  new_password: string
}

export type ChangePasswordResponse = {
  access_token: string
  user: Employee
}

export type CreateEmployeeRequest = {
  email: string
  full_name: string
  role?: 'HR' | 'EMPLOYEE'
  hourly_rate: number
  date_of_birth?: string
}

export type CreateEmployeeResponse = Employee & {
  generated_password: string
}

export type ResetPasswordResponse = Employee & {
  generated_password: string
}
