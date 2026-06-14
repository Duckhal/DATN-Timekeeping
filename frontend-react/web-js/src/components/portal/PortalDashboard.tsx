import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import WorkHistoryRoundedIcon from '@mui/icons-material/WorkHistoryRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { useEffect, useMemo, useState } from 'react'
import { getMyAttendance } from '../../apis/attendanceService'
import type {
  AttendanceItem,
  AttendancePage,
  AttendanceStatusCode,
} from '../../types/attendance'

type PortalDashboardProps = {
  welcomeName: string
}

const STATUS_LABEL: Record<AttendanceStatusCode, string> = {
  COMPLETED: 'Complete',
  SHORTHOURS: 'Short Hours',
  DAYOFF: 'Day Off',
  WEEKEND: 'Weekend',
}

const STATUS_COLOR: Record<
  AttendanceStatusCode,
  'success' | 'warning' | 'default' | 'info'
> = {
  COMPLETED: 'success',
  SHORTHOURS: 'warning',
  DAYOFF: 'default',
  WEEKEND: 'info',
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const next = new Date(y, m - 1 + delta, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return MONTH_LABEL.format(new Date(y, m - 1, 1))
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function dash(value: string | null): string {
  return value ?? '-'
}

export function PortalDashboard({ welcomeName }: PortalDashboardProps) {
  const [month, setMonth] = useState<string>(() => currentMonth())
  const [data, setData] = useState<AttendancePage | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadAttendance = async () => {
      setLoading(true)
      setError(null)

      try {
        const page = await getMyAttendance({ month, pageSize: 31 })
        if (cancelled) return
        setData(page)
      } catch (err: unknown) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load attendance.'
        setError(message)
        setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAttendance()

    return () => {
      cancelled = true
    }
  }, [month])

  const items: AttendanceItem[] = useMemo(() => data?.items ?? [], [data])
  const isCurrentMonth = month === currentMonth()

  // Monthly totals computation: sum of missing_minutes and total_workday
  const summary = useMemo(() => {
    let missing = 0
    let workday = 0
    for (const item of items) {
      missing += item.missing_minutes
      workday += parseFloat(item.total_workday)
    }
    return {
      totalMissingMinutes: missing,
      totalWorkday: workday.toFixed(2),
      daysCounted: items.length,
    }
  }, [items])

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            background:
              'linear-gradient(105deg, rgba(0,160,157,0.18), rgba(0,95,115,0.08))',
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Hello, {welcomeName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Attendance Summary - {formatMonthLabel(month)}
          </Typography>

          {/* Monthly totals */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.5, sm: 4 }}
            sx={{ mt: 2 }}
            divider={
              <Divider
                orientation="vertical"
                flexItem
                sx={{ display: { xs: 'none', sm: 'block' } }}
              />
            }
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Missing Minutes
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {loading ? '—' : summary.totalMissingMinutes}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Workday
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {loading ? '—' : summary.totalWorkday}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Days Counted
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {loading ? '—' : summary.daysCounted}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1}
            sx={{ p: 2 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Attendance Logs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {data
                  ? `${data.total} record${data.total === 1 ? '' : 's'} for ${formatMonthLabel(month)}`
                  : 'Loading…'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton
                size="small"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                aria-label="Previous month"
              >
                <ChevronLeftRoundedIcon />
              </IconButton>
              <Typography variant="body2" sx={{ minWidth: 96, textAlign: 'center' }}>
                {formatMonthLabel(month)}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                disabled={isCurrentMonth}
                aria-label="Next month"
              >
                <ChevronRightRoundedIcon />
              </IconButton>
            </Stack>
          </Stack>

          {error ? (
            <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(0, 160, 157, 0.08)' }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Work Start</TableCell>
                  <TableCell>Work End</TableCell>
                  <TableCell>Check in</TableCell>
                  <TableCell>Check out</TableCell>
                  <TableCell align="right">Missing Minutes</TableCell>
                  <TableCell align="right">Total Workday</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No attendance records for {formatMonthLabel(month)}.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.attendance_id} hover>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell>{dash(item.work_start)}</TableCell>
                      <TableCell>{dash(item.work_end)}</TableCell>
                      <TableCell>{dash(item.checkin_time)}</TableCell>
                      <TableCell>{dash(item.checkout_time)}</TableCell>
                      <TableCell align="right">{item.missing_minutes}</TableCell>
                      <TableCell align="right">
                        {parseFloat(item.total_workday).toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={STATUS_LABEL[item.status]}
                          color={STATUS_COLOR[item.status]}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Quick Actions
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <ScheduleRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="View detailed attendance by date" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <WorkHistoryRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Submit a personal profile update request" />
            </ListItem>
          </List>
        </Paper>
      </Stack>
    </Box>
  )
}
