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
  MenuItem,
  Paper,
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
import { getDevices, removeDevice, updateDevice } from '../apis/deviceService'
import type { Device, DeviceStatus } from '../types/device'

type SnackbarState = {
  open: boolean
  severity: 'success' | 'error' | 'warning' | 'info'
  message: string
}

const DEFAULT_SNACKBAR: SnackbarState = {
  open: false,
  severity: 'info',
  message: '',
}

function statusColor(status: DeviceStatus): 'success' | 'default' | 'warning' {
  if (status === 'ACTIVE') {
    return 'success'
  }

  if (status === 'INACTIVE') {
    return 'default'
  }

  return 'warning'
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

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null)

  const [nameDraft, setNameDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<DeviceStatus>('ACTIVE')

  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR)

  const loadDevices = async () => {
    try {
      setIsLoading(true)
      const data = await getDevices()
      setDevices(data)
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to load devices.'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDevices()
  }, [])

  const tableContent = useMemo(() => {
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

    if (devices.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6}>
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600}>
                No active devices found.
              </Typography>
            </Box>
          </TableCell>
        </TableRow>
      )
    }

    return devices.map((device) => (
      <TableRow key={device.device_id} hover>
        <TableCell>{device.device_id}</TableCell>
        <TableCell>{device.name ?? '-'}</TableCell>
        <TableCell>{device.mac_addr}</TableCell>
        <TableCell>
          <Chip size="small" label={device.status} color={statusColor(device.status)} />
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setEditingDevice(device)
                setNameDraft(device.name ?? '')
                setStatusDraft(device.status)
              }}
            >
              Edit
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => setDeleteTarget(device)}
            >
              Delete
            </Button>
          </Stack>
        </TableCell>
      </TableRow>
    ))
  }, [devices, isLoading])

  const handleSaveEdit = async () => {
    if (!editingDevice) {
      return
    }

    const nextName = nameDraft.trim()

    if (!nextName) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Device name is required.',
      })
      return
    }

    try {
      setIsSaving(true)
      await updateDevice(editingDevice.device_id, {
        name: nextName,
        status: statusDraft,
      })
      setEditingDevice(null)
      await loadDevices()
      setSnackbar({
        open: true,
        severity: 'success',
        message: 'Device updated successfully.',
      })
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to update device.'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }

    try {
      setIsDeleting(true)
      const result = await removeDevice(deleteTarget.device_id)
      setDeleteTarget(null)
      await loadDevices()

      if (result.mode === 'SOFT_DELETE') {
        setSnackbar({
          open: true,
          severity: 'warning',
          message: 'Device was disabled because historical records exist.',
        })
      } else {
        setSnackbar({
          open: true,
          severity: 'success',
          message: 'Device deleted successfully.',
        })
      }
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to delete device.'),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Devices Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage active timekeeping devices.
          </Typography>
        </Box>

        <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>MAC Address</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{tableContent}</TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>

      <Dialog open={Boolean(editingDevice)} onClose={() => setEditingDevice(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Device</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Device name"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Status"
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value as DeviceStatus)}
              fullWidth
            >
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
              <MenuItem value="MAINTENANCE">MAINTENANCE</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingDevice(null)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Device</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to remove this device?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Confirm'}
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
