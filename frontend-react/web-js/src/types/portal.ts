import type { ReactNode } from 'react'

export type AttendanceStatus = 'Complete' | 'Short Hours' | 'Day Off'

export type AttendanceRecord = {
  date: string
  workStart: string
  workEnd: string
  checkIn: string
  checkOut: string
  missingMinutes: number
  totalWorkday: number
  status: AttendanceStatus
}

export type QuickAction = {
  label: string
  icon: ReactNode
}
