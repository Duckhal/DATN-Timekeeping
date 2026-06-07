import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { getAllAttendanceLogs } from '../apis/attendanceLogService'
import type {
  AllAttendanceItem,
  AllAttendancePage,
  AttendanceStatusCode,
} from '../types/attendance'

// ─── Constants ─────────────────────────────────────────────

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

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const

// ─── Helpers ───────────────────────────────────────────────

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// shiftMonth removed — replaced by direct month picker input

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return MONTH_LABEL.format(new Date(y, m - 1, 1))
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function dash(value: string | null): string {
  return value ?? '—'
}

// ─── Component ─────────────────────────────────────────────

export function AttendanceLogPage() {
  const [month, setMonth] = useState<string>(() => currentMonth())
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0) // MUI TablePagination is 0-indexed
  const [pageSize, setPageSize] = useState<number>(20)

  const [data, setData] = useState<AllAttendancePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce search input (300ms)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0) // Reset to first page on search change
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [search])

  // Reset page when month or pageSize changes
  useEffect(() => {
    setPage(0)
  }, [month, pageSize])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAllAttendanceLogs({
        month,
        search: debouncedSearch || undefined,
        page: page + 1, // API is 1-indexed
        pageSize,
      })
      setData(result)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load attendance logs.'
      setError(message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [month, debouncedSearch, page, pageSize])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const items: AllAttendanceItem[] = useMemo(() => data?.items ?? [], [data])
  const total = data?.total ?? 0

  return (
    <Box sx={{ px: { xs: 0, md: 1 }, py: 1 }}>
      <Stack spacing={2.5}>
        {/* Page Header */}
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Attendance Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View daily attendance records of all employees
          </Typography>
        </Box>

        {/* Controls Bar */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            spacing={2}
          >
            {/* Search Field */}
            <TextField
              id="attendance-log-search"
              size="small"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ minWidth: 280, maxWidth: 360 }}
            />

            {/* Month Picker */}
            <TextField
              id="attendance-log-month"
              type="month"
              size="small"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              inputProps={{ max: currentMonth() }}
              sx={{ minWidth: 180 }}
            />
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        )}

        {/* Data Table */}
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(76, 77, 220, 0.06)' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Check In</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Check Out</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Work Start</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Work End</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Total Workday
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Missing Min.
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        {debouncedSearch
                          ? `No attendance records found for "${debouncedSearch}" in ${formatMonthLabel(month)}.`
                          : `No attendance records for ${formatMonthLabel(month)}.`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.attendance_id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {item.employee.full_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {item.employee.email}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell>{dash(item.checkin_time)}</TableCell>
                      <TableCell>{dash(item.checkout_time)}</TableCell>
                      <TableCell>{dash(item.work_start)}</TableCell>
                      <TableCell>{dash(item.work_end)}</TableCell>
                      <TableCell align="right">
                        {parseFloat(item.total_workday).toFixed(4)}
                      </TableCell>
                      <TableCell align="right">{item.missing_minutes}</TableCell>
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

          {/* Pagination */}
          <TablePagination
            id="attendance-log-pagination"
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10))
            }}
            rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
          />
        </Paper>
      </Stack>
    </Box>
  )
}
