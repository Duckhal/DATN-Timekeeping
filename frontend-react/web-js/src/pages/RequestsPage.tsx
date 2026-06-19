import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import {
  createExplanationRequest,
  createOtRequest,
  getMissingCheckoutDays,
  getMyRequests,
} from '../apis/requestService'
import type { MissingCheckoutDay, RequestItem, RequestType } from '../types/request'
import { getApiErrorMessage } from '../utils/getApiErrorMessage'

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
}
const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function RequestsPage() {
  const [tab, setTab] = useState<0 | 1>(0)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)

  // OT dialog
  const [otOpen, setOtOpen] = useState(false)
  const [otReason, setOtReason] = useState('')
  const [otDate, setOtDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [otSubmitting, setOtSubmitting] = useState(false)

  const otMinDate = new Date().toISOString().slice(0, 10)
  const otMaxDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })()

  // Explanation dialog
  const [expOpen, setExpOpen] = useState(false)
  const [expReason, setExpReason] = useState('')
  const [expAttendanceId, setExpAttendanceId] = useState('')
  const [expEndTime, setExpEndTime] = useState('')
  const [expSubmitting, setExpSubmitting] = useState(false)
  const [missingDays, setMissingDays] = useState<MissingCheckoutDay[]>([])

  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const currentType: RequestType = tab === 0 ? 'OT' : 'EXPLANATION'
  const isExpEndTimeMissing = expEndTime.trim() === ''
  const isExpEndTimeFormatInvalid = expEndTime !== '' && !TIME_24H_PATTERN.test(expEndTime)
  const isExpEndTimeInvalid = isExpEndTimeMissing || isExpEndTimeFormatInvalid

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMyRequests({ type: currentType })
      setRequests(data.items)
    } catch {
      setSnack({ message: 'Failed to load requests', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [currentType])

  useEffect(() => {
    void fetchRequests()
  }, [fetchRequests])

  const handleCreateOt = async () => {
    if (!otReason.trim() || !otDate) return
    setOtSubmitting(true)
    try {
      await createOtRequest({ reason: otReason.trim(), date: otDate })
      setOtOpen(false)
      setOtReason('')
      setOtDate(new Date().toISOString().slice(0, 10))
      setSnack({ message: 'OT request created', severity: 'success' })
      void fetchRequests()
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(err, 'Failed to create OT request'),
        severity: 'error',
      })
    } finally {
      setOtSubmitting(false)
    }
  }

  const handleOpenExplanation = async () => {
    setExpOpen(true)
    try {
      const days = await getMissingCheckoutDays()
      setMissingDays(days)
    } catch {
      setSnack({ message: 'Failed to load missing checkout days', severity: 'error' })
    }
  }

  const handleCreateExplanation = async () => {
    if (!expAttendanceId || !expReason.trim() || isExpEndTimeInvalid) return
    setExpSubmitting(true)
    try {
      await createExplanationRequest({
        attendance_id: Number(expAttendanceId),
        reason: expReason.trim(),
        end_time: expEndTime,
      })
      setExpOpen(false)
      setExpReason('')
      setExpAttendanceId('')
      setExpEndTime('')
      setSnack({ message: 'Explanation request created', severity: 'success' })
      void fetchRequests()
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(
          err,
          'Failed to create explanation request',
        ),
        severity: 'error',
      })
    } finally {
      setExpSubmitting(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>My Requests</Typography>
          <Typography variant="body2" color="text.secondary">OT and Explanation requests</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {tab === 0 ? (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOtOpen(true)}>
              New OT Request
            </Button>
          ) : (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenExplanation}>
              New Explanation
            </Button>
          )}
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="OT Requests" />
        <Tab label="Explanation Requests" />
      </Tabs>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'rgba(0, 160, 157, 0.08)' }}>
              <TableCell>Date</TableCell>
              <TableCell>Reason</TableCell>
              {tab === 1 && <TableCell>End Time</TableCell>}
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={tab === 1 ? 5 : 4} align="center" sx={{ py: 4 }}>Loading…</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tab === 1 ? 5 : 4} align="center" sx={{ py: 4 }}>No requests found.</TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.request_id} hover>
                  <TableCell>{r.date}</TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.reason ?? '—'}
                  </TableCell>
                  {tab === 1 && <TableCell>{r.end_time ?? '—'}</TableCell>}
                  <TableCell>
                    <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] ?? 'default'} />
                  </TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* OT Request Dialog */}
      <Dialog open={otOpen} onClose={() => setOtOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New OT Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={otDate}
              onChange={(e) => setOtDate(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: otMinDate, max: otMaxDate }}
              helperText="Allowed range: today through 7 days ahead"
            />
            <TextField
              label="Reason"
              value={otReason}
              onChange={(e) => setOtReason(e.target.value)}
              multiline
              rows={3}
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOtOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateOt} disabled={otSubmitting || !otReason.trim() || !otDate}>
            {otSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Explanation Request Dialog */}
      <Dialog open={expOpen} onClose={() => setExpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Explanation Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Day (missing checkout)</InputLabel>
              <Select
                value={expAttendanceId}
                label="Day (missing checkout)"
                onChange={(e) => {
                  setExpAttendanceId(e.target.value)
                  setExpEndTime('')
                }}
              >
                {missingDays.map((d) => (
                  <MenuItem key={d.attendance_id} value={d.attendance_id}>
                    {d.date} (check-in: {d.checkin_time ?? '—'})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Reason"
              value={expReason}
              onChange={(e) => setExpReason(e.target.value)}
              multiline
              rows={3}
              required
              fullWidth
            />
            <TextField
              label="Actual departure time"
              placeholder="HH:mm"
              value={expEndTime}
              onChange={(e) => setExpEndTime(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              error={isExpEndTimeFormatInvalid}
              inputProps={{
                inputMode: 'numeric',
                maxLength: 5,
                pattern: '([01]\\d|2[0-3]):[0-5]\\d',
              }}
              helperText={
                isExpEndTimeFormatInvalid
                  ? 'Use 24-hour format HH:mm, for example 06:30 or 17:45.'
                  : 'Required'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExpOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateExplanation}
            disabled={expSubmitting || !expAttendanceId || !expReason.trim() || isExpEndTimeInvalid}
          >
            {expSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)}>
        {snack ? (
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
