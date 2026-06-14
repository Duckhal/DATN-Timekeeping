export type Employee = {
  employee_id: number
  email: string
  full_name: string
  role: 'MANAGER' | 'EMPLOYEE'
  date_of_birth: string | null
  hourly_rate: string
  rfid_tag: string | null
  template_fingerprint: string | null
  must_change_password: boolean
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
  role?: 'MANAGER' | 'EMPLOYEE'
  hourly_rate: number
  date_of_birth?: string
}

export type CreateEmployeeResponse = Employee & {
  generated_password: string
}

export type UpdateEmployeeRequest = {
  full_name?: string
  date_of_birth?: string | null
  hourly_rate?: number
}

export type ResetPasswordResponse = Employee & {
  generated_password: string
}
