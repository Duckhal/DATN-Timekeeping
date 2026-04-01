export type Employee = {
  employee_id: number
  email: string
  full_name: string
  role: 'HR' | 'EMPLOYEE'
  date_of_birth: string
  hourly_rate: string
  rfid_tag: string | null
  fingerprint_id: string | null
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  user: Employee
}
