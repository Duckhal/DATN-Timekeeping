export type Employee = {
  employee_id: number
  email: string
  full_name: string
  role: 'HR' | 'EMPLOYEE'
  date_of_birth: string | null
  hourly_rate: string
  rfid_tag: string | null
  template_fingerprint: string | null
  created_at?: string
  updated_at?: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  user: Employee
}
