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

// Cấu trúc State cho Dialog xác nhận xóa
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

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingRfid, setIsSubmittingRfid] = useState(false)
  const [isRemovingCredential, setIsRemovingCredential] = useState(false)

  const [rfidDialogOpen, setRfidDialogOpen] = useState(false)
  const [rfidEmployee, setRfidEmployee] = useState<UnassignedCredentialEmployee | null>(null)
  const [rfidTagDraft, setRfidTagDraft] = useState('')
  const [rfidConflictMessage, setRfidConflictMessage] = useState('')

  const [enroll, setEnroll] = useState<EnrollState>(DEFAULT_ENROLL)
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR)
  
  // Khởi tạo state quản lý việc xác nhận xóa
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmState>(DEFAULT_REMOVE_CONFIRM)

  const loadPageData = async () => {
    try {
      setIsLoading(true)
      const [employeeData, deviceData] = await Promise.all([
        getUnassignedCredentialEmployees(),
        getActiveDevices(),
      ])
      setEmployees(employeeData)
      setActiveDevices(deviceData.filter((item) => item.status === 'ACTIVE'))
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to load credentials data.'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPageData()
  }, [])

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
      await loadPageData()
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

  // Mở hộp thoại trung gian yêu cầu xác nhận trước khi xóa
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

  // Hàm thực thi xóa thật sự sau khi HR đã ấn đồng ý ở Dialog xác nhận
  const handleExecuteRemove = async () => {
    const { employee, type } = removeConfirm
    if (!employee || !type) return

    try {
      setIsRemovingCredential(true)
      setRemoveConfirm(DEFAULT_REMOVE_CONFIRM) // Đóng ngay hộp thoại
      await removeCredential(employee.employee_id, type)
      await loadPageData()

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
    await loadPageData()
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

    if (employees.length === 0) {
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
          <TableCell sx={{ fontWeight: 500 }}>{employee.full_name}</TableCell>
          <TableCell>{employee.email}</TableCell>
          
          {/* Fingerprint Status */}
          <TableCell align="center">
            {hasFingerprint ? (
              <CheckIcon color="success" fontSize="small" titleAccess="Registered" />
            ) : (
              <CancelIcon color="error" fontSize="small" titleAccess="Not Registered" />
            )}
          </TableCell>

          {/* RFID Status and Tag Display */}
          <TableCell>
            <Stack direction="row" spacing={1} alignItems="center">
              {hasRfid ? (
                <>
                  <CheckIcon color="success" fontSize="small" />
                  <Typography variant="body2" fontFamily="monospace" sx={{ bgcolor: 'action.hover', px: 1, py: 0.2, borderRadius: 1 }}>
                    {employee.rfid_tag}
                  </Typography>
                </>
              ) : (
                <>
                  <CancelIcon color="error" fontSize="small" />
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>No card</Typography>
                </>
              )}
            </Stack>
          </TableCell>

          {/* SỬA ĐỔI: Chuyển align thành center và dùng justifyContent="center" để căn giữa tuyệt đối */}
          <TableCell align="center">
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              {/* RFID Actions Group */}
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

              {/* Fingerprint Actions Group */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 0.5 }}>
                <Button 
                  size="small" 
                  variant={hasFingerprint ? "outlined" : "contained"} 
                  onClick={() => openEnrollDialog(employee)}
                  sx={{ minWidth: '140px' }}
                >
                  {hasFingerprint ? 'Re-register Finger' : 'Register Finger'}
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

        <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell width="60px">ID</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell align="center" width="120px">Fingerprint</TableCell>
                  <TableCell width="220px">RFID Status</TableCell>
                  <TableCell align="center" width="450px">Actions</TableCell> 
                </TableRow>
              </TableHead>
              <TableBody>{rows}</TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>

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
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">
                    Please ask the staff to place their finger on the hardware scanner. The device saves automatically.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => void handleRefreshAfterEnroll()}
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

      {/* BỔ SUNG: Hộp thoại xác nhận hủy bỏ phương thức xác thực (Remove Confirmation) */}
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