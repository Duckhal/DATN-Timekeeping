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
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import { SearchInput } from '../components/utils/SearchInput'
import { approveRequest, getManagerRequests, rejectRequest } from '../apis/requestService'
import type { RequestItem, RequestStatus } from '../types/request'
import { getApiErrorMessage } from '../utils/getApiErrorMessage'

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const

const TYPE_COLOR: Record<string, 'info' | 'secondary' | 'default'> = {
  OT: 'info',
  EXPLANATION: 'secondary',
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

const STATUS_COLOR: Record<RequestStatus, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
}

type StatusFilter = RequestStatus | 'ALL'

export function ApprovalsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<RequestItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getManagerRequests({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search || undefined,
        page: page + 1,
        pageSize,
      })
      setRequests(data.items)
      setTotal(data.total)
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(err, 'Failed to load requests'),
        severity: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter])

  useEffect(() => {
    void fetchRequests()
  }, [fetchRequests])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(0)
  }, [])

  const handleStatusChange = (event: SelectChangeEvent<StatusFilter>) => {
    setStatusFilter(event.target.value as StatusFilter)
    setPage(0)
  }

  const handleOpenConfirm = (action: 'approve' | 'reject', request: RequestItem) => {
    if (request.status !== 'PENDING') return
    setConfirmAction(action)
    setConfirmTarget(request)
  }

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
      void fetchRequests()
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(err, 'Action failed'),
        severity: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Approvals</Typography>
          <Typography variant="body2" color="text.secondary">
            Review pending, approved, and rejected employee requests
          </Typography>
        </Box>
      </Stack>

      <Paper>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ p: 2 }}
        >
          <SearchInput
            placeholder="Search by name or email..."
            onSearch={handleSearch}
            sx={{ minWidth: { xs: '100%', md: 280 } }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="request-status-filter-label">Status</InputLabel>
            <Select
              labelId="request-status-filter-label"
              label="Status"
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0, 160, 157, 0.08)' }}>
                <TableCell>Employee</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>End Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>Loading...</TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>No requests found.</TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.request_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {r.employee?.full_name ?? '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.employee?.email ?? '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.type} color={TYPE_COLOR[r.type] ?? 'default'} />
                    </TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.reason ?? '-'}
                    </TableCell>
                    <TableCell>{r.end_time ?? '-'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />
                    </TableCell>
                    <TableCell align="center">
                      {r.status === 'PENDING' ? (
                        <>
                          <Tooltip title="Approve">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleOpenConfirm('approve', r)}
                            >
                              <CheckCircleRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleOpenConfirm('reject', r)}
                            >
                              <CancelRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Processed
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(event) => {
            setPageSize(parseInt(event.target.value, 10))
            setPage(0)
          }}
          rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
        />
      </Paper>

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
            {submitting ? 'Processing...' : confirmAction === 'approve' ? 'Approve' : 'Reject'}
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
