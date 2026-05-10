import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
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

function hasMissingCredential(employee: UnassignedCredentialEmployee, type: 'RFID' | 'FINGERPRINT'): boolean {
  if (type === 'RFID') {
    return !employee.rfid_tag
  }

  return !employee.template_fingerprint
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
    setRfidTagDraft('')
    setRfidConflictMessage('')
    setRfidDialogOpen(true)
  }

  const handleAttachRfid = async () => {
    if (!rfidEmployee) {
      return
    }

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

  const handleRemoveCredential = async (
    employeeId: number,
    type: 'RFID' | 'FINGERPRINT',
  ) => {
    try {
      setIsRemovingCredential(true)
      await removeCredential(employeeId, type)
      await loadPageData()

      const message =
        type === 'RFID'
          ? 'RFID card removed successfully.'
          : 'Fingerprint removed. Online devices will be cleaned up immediately; offline devices will self-heal on the next check-in.'

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
                No employees need credential assignment.
              </Typography>
            </Box>
          </TableCell>
        </TableRow>
      )
    }

    return employees.map((employee) => (
      <TableRow key={employee.employee_id} hover>
        <TableCell>{employee.employee_id}</TableCell>
        <TableCell>{employee.full_name}</TableCell>
        <TableCell>{employee.email}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={1}>
            {hasMissingCredential(employee, 'RFID') ? <Chip size="small" color="warning" label="Missing RFID" /> : null}
            {hasMissingCredential(employee, 'FINGERPRINT') ? <Chip size="small" color="warning" label="Missing Fingerprint" /> : null}
          </Stack>
        </TableCell>
        <TableCell>{employee.rfid_tag ?? '-'}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => openAttachRfidDialog(employee)}>
              Attach RFID card
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              disabled={!employee.rfid_tag || isRemovingCredential}
              onClick={() => void handleRemoveCredential(employee.employee_id, 'RFID')}
            >
              Remove RFID card
            </Button>
            <Button size="small" variant="contained" onClick={() => openEnrollDialog(employee)}>
              Register new fingerprint
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              disabled={!employee.template_fingerprint || isRemovingCredential}
              onClick={() => void handleRemoveCredential(employee.employee_id, 'FINGERPRINT')}
            >
              Remove fingerprint
            </Button>
          </Stack>
        </TableCell>
      </TableRow>
    ))
  }, [employees, isLoading, isRemovingCredential])

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Credentials Assignment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Assign or revoke RFID and fingerprint credentials for employees.
          </Typography>
        </Box>

        <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Missing Credentials</TableCell>
                  <TableCell>Current RFID</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{rows}</TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>

      <Dialog open={rfidDialogOpen} onClose={() => setRfidDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Attach RFID Card</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Employee: {rfidEmployee?.full_name ?? '-'}
            </Typography>
            <TextField
              label="RFID Tag"
              placeholder="Scan or type RFID code"
              value={rfidTagDraft}
              onChange={(event) => setRfidTagDraft(event.target.value)}
              fullWidth
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

      <Dialog open={enroll.open} onClose={closeEnrollDialog} fullWidth maxWidth="sm">
        <DialogTitle>Register New Fingerprint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Employee: {enroll.employee?.full_name ?? '-'}
            </Typography>

            <FormControl fullWidth>
              <InputLabel id="active-device-label">Active Device</InputLabel>
              <Select
                labelId="active-device-label"
                label="Active Device"
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
                {enroll.isStarting ? 'Starting...' : 'Start scanning'}
              </Button>
            ) : null}

            {enroll.hasStarted ? (
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">
                    Please ask the staff to place your hand on the scanner. The device saves automatically.
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
