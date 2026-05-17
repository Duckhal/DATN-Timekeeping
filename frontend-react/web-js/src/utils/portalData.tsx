import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded'
import NightlightRoundRoundedIcon from '@mui/icons-material/NightlightRoundRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import WorkHistoryRoundedIcon from '@mui/icons-material/WorkHistoryRounded'
import type { QuickAction } from '../types/portal'

export const quickActions: QuickAction[] = [
  { label: 'Leave Request', icon: <EventBusyRoundedIcon /> },
  { label: 'Overtime Request', icon: <NightlightRoundRoundedIcon /> },
  { label: 'Attendance List', icon: <ScheduleRoundedIcon /> },
  { label: 'Assets', icon: <WorkHistoryRoundedIcon /> },
]
