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
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import { approveRequest, getPendingRequests, rejectRequest } from '../apis/requestService'
import type { RequestItem } from '../types/request'

const TYPE_COLOR: Record<string, 'info' | 'secondary' | 'default'> = {
  OT: 'info',
  EXPLANATION: 'secondary',
}

export function ApprovalsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<RequestItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendingRequests()
      setRequests(data.items)
    } catch {
      setSnack({ message: 'Failed to load pending requests', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPending()
  }, [fetchPending])

  const handleConfirm = async () => {
    if (!confirmTarget || !confirmAction) return
    setSubmitting(true)
    try {
      if (confirmAction === 'approve') {
        await approveRequest(confirmTarget.request_id)
        setSnack({ message: 'Request approved', severity: 'success' })
      } else {
        await rejectRequest(confirmTarget.request_id)
        setSnack({ message: 'Request rejected', severity: 'success' })
      }
      setConfirmAction(null)
      setConfirmTarget(null)
      void fetchPending()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Action failed'
      setSnack({ message: msg, severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Approvals</Typography>
          <Typography variant="body2" color="text.secondary">Pending requests from employees</Typography>
        </Box>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'rgba(0, 160, 157, 0.08)' }}>
              <TableCell>Employee</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>Loading…</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>No pending requests.</TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.request_id} hover>
                  <TableCell>{r.employee?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.type} color={TYPE_COLOR[r.type] ?? 'default'} />
                  </TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.reason ?? '—'}
                  </TableCell>
                  <TableCell>{r.end_time ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Approve">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => { setConfirmAction('approve'); setConfirmTarget(r) }}
                      >
                        <CheckCircleRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reject">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => { setConfirmAction('reject'); setConfirmTarget(r) }}
                      >
                        <CancelRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirmation Dialog */}
      <Dialog open={confirmAction !== null} onClose={() => { setConfirmAction(null); setConfirmTarget(null) }}>
        <DialogTitle>
          {confirmAction === 'approve' ? 'Approve Request' : 'Reject Request'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmAction === 'approve'
              ? `Approve ${confirmTarget?.type} request from ${confirmTarget?.employee?.full_name}?`
              : `Reject ${confirmTarget?.type} request from ${confirmTarget?.employee?.full_name}?`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setConfirmAction(null); setConfirmTarget(null) }}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmAction === 'approve' ? 'success' : 'error'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Processing…' : confirmAction === 'approve' ? 'Approve' : 'Reject'}
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
