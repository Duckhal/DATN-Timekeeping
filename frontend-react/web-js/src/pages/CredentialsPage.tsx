import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
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
  TextField,
  Typography,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material'
import {
  attachRfidCard,
  getActiveDevices,
  getUnassignedCredentialEmployees,
  removeCredential,
  startFingerprintEnroll,
} from '../apis/credentialsService'
import { SearchInput } from '../components/utils/SearchInput' // Embedded reusable SearchInput module
import type { UnassignedCredentialEmployee } from '../types/credentials'
import type { Device } from '../types/device'

type SnackbarState = {
  open: boolean
  severity: 'success' | 'error' | 'warning' | 'info'
  message: string
}

type EnrollState = {
  open: boolean
  employee: UnassignedCredentialEmployee | null
  selectedDeviceId: number | ''
  isStarting: boolean
  hasStarted: boolean
}

type RemoveConfirmState = {
  open: boolean
  employee: UnassignedCredentialEmployee | null
  type: 'RFID' | 'FINGERPRINT' | null
}

const DEFAULT_SNACKBAR: SnackbarState = {
  open: false,
  severity: 'info',
  message: '',
}

const DEFAULT_ENROLL: EnrollState = {
  open: false,
  employee: null,
  selectedDeviceId: '',
  isStarting: false,
  hasStarted: false,
}

const DEFAULT_REMOVE_CONFIRM: RemoveConfirmState = {
  open: false,
  employee: null,
  type: null,
}

const PAGE_SIZE_OPTIONS = [1, 10, 20, 50, 100] as const

function getApiErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ message?: string | string[] }>
  const message = axiosError.response?.data?.message

  if (Array.isArray(message) && message.length > 0) {
    return message.join(', ')
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message
  }

  return fallback
}

export function CredentialsPage() {
  const [employees, setEmployees] = useState<UnassignedCredentialEmployee[]>([])
  const [activeDevices, setActiveDevices] = useState<Device[]>([])

  // 1. Added Search and Pagination States Configured for Server-side Filtering
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)   // MUI TablePagination is 0-indexed
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingRfid, setIsSubmittingRfid] = useState(false)
  const [isRemovingCredential, setIsRemovingCredential] = useState(false)

  const [rfidDialogOpen, setRfidDialogOpen] = useState(false)
  const [rfidEmployee, setRfidEmployee] = useState<UnassignedCredentialEmployee | null>(null)
  const [rfidTagDraft, setRfidTagDraft] = useState('')
  const [rfidConflictMessage, setRfidConflictMessage] = useState('')

  const [enroll, setEnroll] = useState<EnrollState>(DEFAULT_ENROLL)
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR)
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmState>(DEFAULT_REMOVE_CONFIRM)

  // 2. Core API Fetching Engine Passing Safe Isolated Realtime Parameters
  const loadPageData = async (currentPage: number, currentLimit: number, currentSearch: string) => {
    try {
      setIsLoading(true)
      const [employeeData, deviceData] = await Promise.all([
        getUnassignedCredentialEmployees(currentPage + 1, currentLimit, currentSearch),
        getActiveDevices(),
      ])

      setEmployees(employeeData.items || [])
      setTotal(employeeData.meta.total || 0)
      setActiveDevices(deviceData.filter((item) => item.status === 'ACTIVE'))
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to load credentials data.'),
      })
      setEmployees([]) // Fallback to safe array on error
    } finally {
      setIsLoading(false)
    }
  }

  // Reactive listener dispatching clean non-blocking network handshakes
  useEffect(() => {
    void loadPageData(page, limit, search)
  }, [page, limit, search])

  // Prevent unexpected jump reset unless absolute key difference is confirmed
  const handleSearchSubmit = (value: string) => {
    if (value.trim() !== search.trim()) {
      setSearch(value)
      setPage(0)
    }
  }

  const openAttachRfidDialog = (employee: UnassignedCredentialEmployee) => {
    setRfidEmployee(employee)
    setRfidTagDraft(employee.rfid_tag ?? '')
    setRfidConflictMessage('')
    setRfidDialogOpen(true)
  }

  const handleAttachRfid = async () => {
    if (!rfidEmployee) return

    const normalizedTag = rfidTagDraft.trim()
    if (!normalizedTag) {
      setRfidConflictMessage('RFID tag is required.')
      return
    }

    try {
      setIsSubmittingRfid(true)
      setRfidConflictMessage('')
      await attachRfidCard(rfidEmployee.employee_id, { rfid_tag: normalizedTag })
      setRfidDialogOpen(false)
      await loadPageData(page, limit, search)
      setSnackbar({
        open: true,
        severity: 'success',
        message: 'RFID card attached successfully.',
      })
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>
      if (axiosError.response?.status === 409) {
        setRfidConflictMessage('This RFID card is already assigned to another employee.')
        return
      }
      setRfidConflictMessage(getApiErrorMessage(error, 'Unable to attach RFID card.'))
    } finally {
      setIsSubmittingRfid(false)
    }
  }

  const triggerRemoveConfirmation = (
    employee: UnassignedCredentialEmployee,
    type: 'RFID' | 'FINGERPRINT'
  ) => {
    setRemoveConfirm({
      open: true,
      employee,
      type,
    })
  }

  const handleExecuteRemove = async () => {
    const { employee, type } = removeConfirm
    if (!employee || !type) return

    try {
      setIsRemovingCredential(true)
      setRemoveConfirm(DEFAULT_REMOVE_CONFIRM)
      await removeCredential(employee.employee_id, type)
      await loadPageData(page, limit, search)

      const message =
        type === 'RFID'
          ? `Successfully removed RFID card for ${employee.full_name}.`
          : `Fingerprint for ${employee.full_name} removed. Online hardware devices will synchronize immediately.`

      setSnackbar({
        open: true,
        severity: 'success',
        message,
      })
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to remove credential.'),
      })
    } finally {
      setIsRemovingCredential(false)
    }
  }

  const openEnrollDialog = (employee: UnassignedCredentialEmployee) => {
    setEnroll({
      ...DEFAULT_ENROLL,
      open: true,
      employee,
    })
  }

  const closeEnrollDialog = () => {
    setEnroll(DEFAULT_ENROLL)
  }

  const handleStartScanning = async () => {
    if (!enroll.employee || enroll.selectedDeviceId === '') {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Please select an active device first.',
      })
      return
    }

    try {
      setEnroll((prev) => ({ ...prev, isStarting: true }))
      await startFingerprintEnroll(enroll.selectedDeviceId, enroll.employee.employee_id)
      setEnroll((prev) => ({ ...prev, hasStarted: true }))
      setSnackbar({
        open: true,
        severity: 'info',
        message: 'Scanning command sent. The device will save the fingerprint automatically when done.',
      })
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to start fingerprint scanning.'),
      })
    } finally {
      setEnroll((prev) => ({ ...prev, isStarting: false }))
    }
  }

  const handleRefreshAfterEnroll = async () => {
    closeEnrollDialog()
    await loadPageData(page, limit, search)
  }

  const rows = useMemo(() => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={6}>
            <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
              <CircularProgress />
            </Box>
          </TableCell>
        </TableRow>
      )
    }

    if (!employees || employees.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6}>
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600}>
                No employees found in the system.
              </Typography>
            </Box>
          </TableCell>
        </TableRow>
      )
    }

    return employees.map((employee) => {
      const hasRfid = !!employee.rfid_tag
      const hasFingerprint = !!employee.template_fingerprint

      return (
        <TableRow key={employee.employee_id} hover>
          <TableCell>{employee.employee_id}</TableCell>
          
          <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
            {employee.full_name}
          </TableCell>
          
          <TableCell>{employee.email}</TableCell>
          
          <TableCell align="center">
            {hasFingerprint ? (
              <CheckIcon color="success" fontSize="small" />
            ) : (
              <CancelIcon color="error" fontSize="small" />
            )}
          </TableCell>

          <TableCell>
            <Stack direction="row" spacing={1} alignItems="center">
              {hasRfid ? (
                <>
                  <CheckIcon color="success" fontSize="small" />
                  <Typography variant="body2" fontFamily="monospace" sx={{ bgcolor: 'action.hover', px: 1, py: 0.2, borderRadius: 1, whiteSpace: 'nowrap' }}>
                    {employee.rfid_tag}
                  </Typography>
                </>
              ) : (
                <>
                  <CancelIcon color="error" fontSize="small" />
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                    No card
                  </Typography>
                </>
              )}
            </Stack>
          </TableCell>

          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <Box sx={{ borderRight: '1px solid', borderColor: 'divider', pr: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => openAttachRfidDialog(employee)}
                  sx={{ minWidth: '100px' }}
                >
                  {hasRfid ? 'Change RFID' : 'Attach RFID'}
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="text"
                  disabled={!hasRfid || isRemovingCredential}
                  onClick={() => triggerRemoveConfirmation(employee, 'RFID')}
                >
                  Remove
                </Button>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 0.5 }}>
                <Button 
                  size="small" 
                  variant={hasFingerprint ? "outlined" : "contained"} 
                  onClick={() => openEnrollDialog(employee)}
                  disabled={hasFingerprint}
                  sx={{ 
                    minWidth: '140px',
                    "&.Mui-disabled": {
                      bgcolor: 'action.disabledBackground',
                      color: 'action.disabled'
                    }
                  }}
                >
                  {hasFingerprint ? 'Registered' : 'Register Finger'}
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="text"
                  disabled={!hasFingerprint || isRemovingCredential}
                  onClick={() => triggerRemoveConfirmation(employee, 'FINGERPRINT')}
                >
                  Remove
                </Button>
              </Stack>
            </Stack>
          </TableCell>
        </TableRow>
      )
    })
  }, [employees, isLoading, isRemovingCredential])

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Credentials Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View, assign, modify or revoke RFID and fingerprint authentication for all employees.
          </Typography>
        </Box>

        {/* 3. Rendered custom search bar container directly above the data layout container */}
        <Box sx={{ mt: 1 }}>
          <SearchInput 
            placeholder="Search by name, email or RFID..." 
            onSearch={handleSearchSubmit} 
          />
        </Box>

        <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell width="8%">ID</TableCell>
                  <TableCell width="22%">Full Name</TableCell>
                  <TableCell width="25%">Email</TableCell>
                  <TableCell align="center" width="12%">Fingerprint</TableCell>
                  <TableCell width="13%">RFID Status</TableCell>
                  <TableCell align="center" width="20%" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell> 
                </TableRow>
              </TableHead>
              <TableBody>{rows}</TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={limit}
            onRowsPerPageChange={(e) => {
              setLimit(parseInt(e.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
          />
        </Paper>
      </Stack>

      {/* 4. Custom Pagination Component integration mapped directly below the paper grid */}

      {/* Dialog Attach/Edit RFID */}
      <Dialog open={rfidDialogOpen} onClose={() => setRfidDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{rfidEmployee?.rfid_tag ? 'Modify RFID Card' : 'Attach RFID Card'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Employee: <strong>{rfidEmployee?.full_name}</strong>
            </Typography>
            <TextField
              label="RFID Tag Code"
              placeholder="Scan or type RFID code"
              value={rfidTagDraft}
              onChange={(event) => setRfidTagDraft(event.target.value)}
              fullWidth
              autoFocus
            />
            {rfidConflictMessage ? <Alert severity="error">{rfidConflictMessage}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRfidDialogOpen(false)} disabled={isSubmittingRfid}>
            Cancel
          </Button>
          <Button onClick={handleAttachRfid} variant="contained" disabled={isSubmittingRfid}>
            {isSubmittingRfid ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Register Fingerprint */}
      <Dialog open={enroll.open} onClose={closeEnrollDialog} fullWidth maxWidth="sm">
        <DialogTitle>Register Fingerprint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Employee: <strong>{enroll.employee?.full_name}</strong>
            </Typography>

            <FormControl fullWidth>
              <InputLabel id="active-device-label">Select Active Scanner</InputLabel>
              <Select
                labelId="active-device-label"
                label="Select Active Scanner"
                value={enroll.selectedDeviceId}
                onChange={(event) => {
                  setEnroll((prev) => ({
                    ...prev,
                    selectedDeviceId: Number(event.target.value),
                  }))
                }}
                disabled={enroll.hasStarted}
              >
                {activeDevices.map((device) => (
                  <MenuItem key={device.device_id} value={device.device_id}>
                    {device.name} (#{device.device_id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!enroll.hasStarted ? (
              <Button
                variant="contained"
                onClick={handleStartScanning}
                disabled={enroll.isStarting || activeDevices.length === 0}
              >
                {enroll.isStarting ? 'Starting...' : 'Start scanning command'}
              </Button>
            ) : null}

            {enroll.hasStarted ? (
              <Stack spacing={2}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 1, 
                    bgcolor: 'rgba(76, 77, 220, 0.05)',
                    p: 2, 
                    borderRadius: '8px',
                    border: '1px dashed',
                    borderColor: 'primary.main'
                  }}
                >
                  <Typography variant="subtitle2" color="primary.main" fontWeight={650}>
                    ENROLLMENT COMMAND SENT TO DEVICE
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.5 }}>
                    1. Please ask the staff to place their finger on the hardware scanner <strong>3 times consecutively</strong>.
                    <br />
                    2. Once the device emits a <strong>SUCCESS BEEP</strong> (or flashes a green light), click the button below to update the credentials list.
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  color="success"
                  onClick={() => void handleRefreshAfterEnroll()}
                  fullWidth
                  sx={{ 
                    py: 1, 
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(46, 125, 50, 0.2)',
                    '&:hover': { bgcolor: 'success.dark' }
                  }}
                >
                  Done - Refresh list
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEnrollDialog} disabled={enroll.isStarting}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revocation Confirmation Dialog */}
      <Dialog
        open={removeConfirm.open}
        onClose={() => setRemoveConfirm(DEFAULT_REMOVE_CONFIRM)}
        aria-labelledby="remove-confirm-title"
        aria-describedby="remove-confirm-description"
      >
        <DialogTitle id="remove-confirm-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon color="error" /> Confirm Revocation
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="remove-confirm-description">
            Are you sure you want to completely revoke the <strong>{removeConfirm.type}</strong> credential for employee <strong>{removeConfirm.employee?.full_name}</strong>? 
            This action cannot be undone and will impact hardware authorization modules immediately.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoveConfirm(DEFAULT_REMOVE_CONFIRM)} color="inherit" variant="outlined">
            Cancel
          </Button>
          <Button onClick={() => void handleExecuteRemove()} color="error" variant="contained" autoFocus>
            Revoke Credential
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar(DEFAULT_SNACKBAR)}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(DEFAULT_SNACKBAR)}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}