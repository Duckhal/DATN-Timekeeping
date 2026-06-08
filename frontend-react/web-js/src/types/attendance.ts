export type AttendanceStatusCode = 'COMPLETED' | 'SHORTHOURS' | 'DAYOFF' | 'WEEKEND'

export type AttendanceItem = {
  attendance_id: string
  date: string // YYYY-MM-DD
  checkin_time: string | null // HH:mm:ss
  checkout_time: string | null
  work_start: string | null // HH:mm
  work_end: string | null
  missing_minutes: number
  total_workday: string // decimal as string, e.g. "0.5354"
  status: AttendanceStatusCode
}

export type AttendancePage = {
  items: AttendanceItem[]
  page: number
  pageSize: number
  total: number
  range: { from: string; to: string }
}

export type AttendanceQuery = {
  month?: string // YYYY-MM
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
  page?: number
  pageSize?: number
}

export type AllAttendanceItem = AttendanceItem & {
  employee: {
    employee_id: number
    email: string
    full_name: string
  }
}

export type AllAttendancePage = {
  items: AllAttendanceItem[]
  page: number
  pageSize: number
  total: number
  range: { from: string; to: string }
}

export type AllAttendanceQuery = {
  month?: string
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
}

export type EmployeeAttendanceSummary = {
  employee: {
    employee_id: number
    email: string
    full_name: string
  }
  total_missing_minutes: number
  total_workday: string // sum of daily credits, 2 decimals
  days_counted: number
}

export type AttendanceSummaryResponse = {
  range: { from: string; to: string }
  matched: number // number of distinct employees matching the search
  summaries: EmployeeAttendanceSummary[]
}
