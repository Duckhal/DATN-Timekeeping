import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
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
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import { SearchInput } from '../components/utils/SearchInput'
import {
  getAllAttendanceLogs,
  getAttendanceSummary,
} from '../apis/attendanceLogService'
import { publishPayroll } from '../apis/payrollService'
import type {
  AllAttendanceItem,
  AllAttendancePage,
  AttendanceStatusCode,
  EmployeeAttendanceSummary,
} from '../types/attendance'
import { getApiErrorMessage } from '../utils/getApiErrorMessage'

// Constants
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

const PAGE_SIZE_OPTIONS = [1, 10, 20, 50, 100] as const

// Helpers
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

// Component
export function AttendanceLogPage() {
  const [month, setMonth] = useState<string>(() => currentMonth())
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0) // MUI TablePagination is 0-indexed
  const [pageSize, setPageSize] = useState<number>(20)

  const [data, setData] = useState<AllAttendancePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Monthly summary (total missing_minutes + total_workday) for the searched
  // employee. Only computable when the current search resolves to exactly one
  // employee, so we track that distinct-employee count from the loaded page.
  const [summary, setSummary] = useState<EmployeeAttendanceSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [snack, setSnack] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  // Debounced search now comes from the shared SearchInput component.
  const handleSearch = useCallback((value: string) => {
    setDebouncedSearch(value)
    setPage(0) // Reset to first page on search change
    setSummary(null) // Drop a stale summary when the filter changes
    setSummaryError(null)
  }, [])

  // Reset page when month or pageSize changes
  useEffect(() => {
    setPage(0)
  }, [month, pageSize])

  // Clear any existing summary when the month changes — it no longer matches.
  useEffect(() => {
    setSummary(null)
    setSummaryError(null)
  }, [month])

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

  // Count distinct employee IDs in the currently loaded page to determine if the search resolves to a single employee for summary calculation. This is a bit
  // hacky but avoids an extra API call just to get the count of matched
  // employees for the current search+month filter.
  const distinctEmployeeIds = useMemo(() => {
    const ids = new Set<number>()
    for (const item of items) ids.add(item.employee.employee_id)
    return ids
  }, [items])

  const hasSearch = debouncedSearch.trim().length > 0
  const singleEmployeeMatched = distinctEmployeeIds.size === 1
  const canCalculate =
    hasSearch && singleEmployeeMatched && total > 0 && !loading

  const handleCalculateSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    setSummary(null)
    try {
      const result = await getAttendanceSummary({
        month,
        search: debouncedSearch.trim(),
      })
      if (result.matched === 0) {
        setSummaryError('No matching employee found for this search.')
        return
      }
      if (result.matched > 1) {
        setSummaryError(
          'Search matches multiple employees. Please refine the search to a single employee.',
        )
        return
      }
      setSummary(result.summaries[0])
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to calculate summary.'
      setSummaryError(message)
    } finally {
      setSummaryLoading(false)
    }
  }, [month, debouncedSearch])

  const handlePublishPayroll = useCallback(async () => {
    if (!month) return
    setPublishing(true)
    try {
      const result = await publishPayroll(month)
      setPublishConfirmOpen(false)
      setSnack({
        message: `Published payroll for ${result.published_count} employee${result.published_count === 1 ? '' : 's'}.`,
        severity: 'success',
      })
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(err, 'Failed to publish payroll.'),
        severity: 'error',
      })
    } finally {
      setPublishing(false)
    }
  }, [month])

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
            <SearchInput
              placeholder="Search by name or email…"
              onSearch={handleSearch}
            />

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
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

              {/* Calculate monthly total — enabled only when search resolves
                  to a single employee on the loaded page. */}
              <Button
                variant="contained"
                startIcon={
                  summaryLoading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <CalculateRoundedIcon />
                  )
                }
                disabled={!canCalculate || summaryLoading}
                onClick={() => void handleCalculateSummary()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Calculate Total
              </Button>

              <Button
                variant="outlined"
                startIcon={
                  publishing ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <PaidRoundedIcon />
                  )
                }
                disabled={!month || publishing}
                onClick={() => setPublishConfirmOpen(true)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Publish Payroll
              </Button>
            </Stack>
          </Stack>

          {/* Hint when the button is disabled because of an ambiguous search */}
          {hasSearch && !singleEmployeeMatched && total > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              Search matches multiple employees. Refine to a single name or
              email to calculate the monthly total.
            </Typography>
          )}
          {!hasSearch && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              Type an employee name or email to enable monthly total
              calculation.
            </Typography>
          )}
        </Paper>

        {/* Summary error */}
        {summaryError && (
          <Alert severity="warning" variant="outlined" onClose={() => setSummaryError(null)}>
            {summaryError}
          </Alert>
        )}

        {/* Monthly Summary Banner */}
        {summary && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'primary.main',
              borderRadius: 2,
              background:
                'linear-gradient(105deg, rgba(76,77,220,0.10), rgba(76,77,220,0.03))',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1.5, sm: 3 }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              divider={
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
              }
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {summary.employee.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.employee.email} · {formatMonthLabel(month)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Missing Minutes
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {summary.total_missing_minutes}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Workday
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {summary.total_workday}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Days Counted
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {summary.days_counted}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

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

        <Dialog
          open={publishConfirmOpen}
          onClose={() => !publishing && setPublishConfirmOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Publish Payroll</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Publish payroll for {formatMonthLabel(month)} to all active
              employees? Existing payroll records for this month will be
              overwritten and employees will receive a new notification.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setPublishConfirmOpen(false)}
              disabled={publishing}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void handlePublishPayroll()}
              disabled={publishing}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snack !== null}
          autoHideDuration={3500}
          onClose={() => setSnack(null)}
        >
          {snack ? (
            <Alert
              severity={snack.severity}
              variant="filled"
              onClose={() => setSnack(null)}
            >
              {snack.message}
            </Alert>
          ) : undefined}
        </Snackbar>
      </Stack>
    </Box>
  )
}
