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
import { useNavigate } from 'react-router-dom'
import {
  createExplanationRequest,
  createOtRequest,
  getMissingCheckoutDays,
  getMyRequests,
} from '../apis/requestService'
import { useAuth } from '../hooks/useAuth'
import type { MissingCheckoutDay, RequestItem, RequestType } from '../types/request'

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
}

export function RequestsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const managerName = profile?.manager?.email?.split('@')[0] ?? '—'
  const [tab, setTab] = useState<0 | 1>(0)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)

  // OT dialog
  const [otOpen, setOtOpen] = useState(false)
  const [otReason, setOtReason] = useState('')
  const [otSubmitting, setOtSubmitting] = useState(false)

  // Explanation dialog
  const [expOpen, setExpOpen] = useState(false)
  const [expReason, setExpReason] = useState('')
  const [expAttendanceId, setExpAttendanceId] = useState('')
  const [expEndTime, setExpEndTime] = useState('')
  const [expNeedsEndTime, setExpNeedsEndTime] = useState(false)
  const [expSubmitting, setExpSubmitting] = useState(false)
  const [missingDays, setMissingDays] = useState<MissingCheckoutDay[]>([])

  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const currentType: RequestType = tab === 0 ? 'OT' : 'EXPLANATION'

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
    if (!otReason.trim()) return
    setOtSubmitting(true)
    try {
      await createOtRequest({ reason: otReason.trim() })
      setOtOpen(false)
      setOtReason('')
      setSnack({ message: 'OT request created', severity: 'success' })
      void fetchRequests()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to create OT request'
      setSnack({ message: msg, severity: 'error' })
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
    if (!expAttendanceId || !expReason.trim()) return
    setExpSubmitting(true)
    try {
      await createExplanationRequest({
        attendance_id: Number(expAttendanceId),
        reason: expReason.trim(),
        end_time: expNeedsEndTime && expEndTime ? expEndTime : undefined,
      })
      setExpOpen(false)
      setExpReason('')
      setExpAttendanceId('')
      setExpEndTime('')
      setExpNeedsEndTime(false)
      setSnack({ message: 'Explanation request created', severity: 'success' })
      void fetchRequests()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to create explanation request'
      setSnack({ message: msg, severity: 'error' })
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
          <Button variant="outlined" size="small" onClick={() => navigate('/portal')}>
            Back to Portal
          </Button>
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
            <TextField label="Approver" value={managerName} fullWidth InputProps={{ readOnly: true }} />
            <TextField label="Date" value={new Date().toISOString().slice(0, 10)} fullWidth InputProps={{ readOnly: true }} />
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
          <Button variant="contained" onClick={handleCreateOt} disabled={otSubmitting || !otReason.trim()}>
            {otSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Explanation Request Dialog */}
      <Dialog open={expOpen} onClose={() => setExpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Explanation Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Approver" value={managerName} fullWidth InputProps={{ readOnly: true }} />
            <FormControl fullWidth required>
              <InputLabel>Day (missing checkout)</InputLabel>
              <Select
                value={expAttendanceId}
                label="Day (missing checkout)"
                onChange={(e) => {
                  setExpAttendanceId(e.target.value)
                  setExpNeedsEndTime(false)
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
            {expNeedsEndTime && (
              <TextField
                label="Actual departure time (HH:mm)"
                type="time"
                value={expEndTime}
                onChange={(e) => setExpEndTime(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Required because this day has an approved OT request"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExpOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateExplanation}
            disabled={expSubmitting || !expAttendanceId || !expReason.trim()}
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
