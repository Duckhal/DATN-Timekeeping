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
