import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded'
import NightlightRoundRoundedIcon from '@mui/icons-material/NightlightRoundRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import WorkHistoryRoundedIcon from '@mui/icons-material/WorkHistoryRounded'
import type { AttendanceRecord, QuickAction } from '../types/portal'

export const quickActions: QuickAction[] = [
  { label: 'Leave Request', icon: <EventBusyRoundedIcon /> },
  { label: 'Overtime Request', icon: <NightlightRoundRoundedIcon /> },
  { label: 'Attendance List', icon: <ScheduleRoundedIcon /> },
  { label: 'Assets', icon: <WorkHistoryRoundedIcon /> },
]

export const attendanceRecords: AttendanceRecord[] = [
  {
    date: '24/03/2026',
    workStart: '08:00',
    workEnd: '17:30',
    checkIn: '13:47:57',
    checkOut: '18:03:08',
    missingMinutes: 223,
    totalWorkday: 0.5354,
    status: 'Short Hours',
  },
  {
    date: '23/03/2026',
    workStart: '08:30',
    workEnd: '18:00',
    checkIn: '09:38:11',
    checkOut: '18:12:35',
    missingMinutes: 55,
    totalWorkday: 0.8854,
    status: 'Short Hours',
  },
  {
    date: '22/03/2026',
    workStart: '-',
    workEnd: '-',
    checkIn: '-',
    checkOut: '-',
    missingMinutes: 0,
    totalWorkday: 0,
    status: 'Day Off',
  },
  {
    date: '20/03/2026',
    workStart: '09:00',
    workEnd: '18:30',
    checkIn: '08:11:43',
    checkOut: '17:40:55',
    missingMinutes: 0,
    totalWorkday: 1,
    status: 'Complete',
  },
]
