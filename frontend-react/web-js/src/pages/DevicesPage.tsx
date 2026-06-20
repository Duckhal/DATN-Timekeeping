import { useCallback, useEffect, useMemo, useState } from 'react'
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import { bulkSyncDevice, getManagerDevices, removeDevice, updateDevice } from '../apis/deviceService'
import { SearchInput } from '../components/utils/SearchInput'
import type { Device, DeviceStatus } from '../types/device'

const PAGE_SIZE_OPTIONS = [1, 10, 20, 50, 100] as const

type StatusFilter = DeviceStatus | 'ALL'

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

function formatStatus(status: DeviceStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
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
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(20)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null)

  const [nameDraft, setNameDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<DeviceStatus>('ACTIVE')

  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR)

  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getManagerDevices({
        search: search || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: page + 1,
        pageSize,
      })
      setDevices(data.items)
      setTotal(data.total)
      return data
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to load devices.'),
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, statusFilter])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(0)
  }, [])

  const handleStatusChange = (event: SelectChangeEvent<StatusFilter>) => {
    setStatusFilter(event.target.value as StatusFilter)
    setPage(0)
  }

  const refreshAfterMutation = useCallback(async () => {
    const data = await loadDevices()
    if (data && data.items.length === 0 && page > 0) {
      setPage(page - 1)
    }
  }, [loadDevices, page])

  const tableContent = useMemo(() => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={5}>
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
          <TableCell colSpan={5}>
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600}>
                No devices found.
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
          <Chip size="small" label={formatStatus(device.status)} color={statusColor(device.status)} />
        </TableCell>
        <TableCell align="center">
          <Stack direction="row" spacing={0.5} justifyContent="center">
            <Tooltip title="Edit Device">
              <IconButton
                size="small"
                color="primary"
                onClick={() => {
                  setEditingDevice(device)
                  setNameDraft(device.name ?? '')
                  setStatusDraft(device.status)
                }}
              >
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={device.status === 'ACTIVE' ? 'Sync Device' : 'Only active devices can be synced'}
            >
              <span>
                <IconButton
                  size="small"
                  color="info"
                  disabled={device.status !== 'ACTIVE'}
                  onClick={() => handleBulkSync(device)}
                >
                  <SyncRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete Device">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteTarget(device)}
              >
                <DeleteRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
      await refreshAfterMutation()
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
      await refreshAfterMutation()

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

  const handleBulkSync = async (device: Device) => {
    try {
      await bulkSyncDevice(device.device_id)
      setSnackbar({
        open: true,
        severity: 'success',
        message: `Sync command sent to ${device.name ?? device.mac_addr}.`,
      })
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: getApiErrorMessage(error, 'Unable to trigger sync.'),
      })
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Devices Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage active timekeeping devices.
          </Typography>
        </Box>

        <Paper>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ p: 2 }}
          >
            <SearchInput
              placeholder="Search by name or MAC address..."
              onSearch={handleSearch}
              sx={{ minWidth: { xs: '100%', md: 280 } }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="device-status-filter-label">Status</InputLabel>
              <Select
                labelId="device-status-filter-label"
                label="Status"
                value={statusFilter}
                onChange={handleStatusChange}
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
                <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(0, 160, 157, 0.08)' }}>
                  <TableCell>ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>MAC Address</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{tableContent}</TableBody>
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
