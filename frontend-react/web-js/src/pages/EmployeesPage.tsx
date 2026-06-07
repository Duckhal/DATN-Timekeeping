import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import {
  createEmployee,
  deleteEmployee,
  getAllEmployees,
  resetEmployeePassword,
} from '../apis/employeeService'
import { SearchInput } from '../components/utils/SearchInput'
import { useAuth } from '../hooks/useAuth'
import type { Employee } from '../types/auth'

export function EmployeesPage() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // 1. Pagination and Remote Search State Configurations
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)             // Active Page Index (Starts at 1)
  const [limit, setLimit] = useState(10)          // Standard safe default record count
  const [totalPages, setTotalPages] = useState(1) // Total accessible data boundary blocks

  // Create Employee Form Dialog State
  const [createOpen, setCreateOpen] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formRate, setFormRate] = useState('')
  const [formDob, setFormDob] = useState('')
  const [creating, setCreating] = useState(false)

  // Reset Password Confirmation Intermediary Modal States
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [employeeToReset, setEmployeeToReset] = useState<Employee | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  // Soft Delete Account Confirmation Intermediary Modal States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  // Generated temporary credentials display dialog state
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [generatedFor, setGeneratedFor] = useState('')
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  // Global Notification Toast State
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  // 2. Core Fetch Engine (Decoupled from dependency updates to stop race conditions)
  const fetchEmployees = async (currentPage: number, currentLimit: number, currentSearch: string) => {
    try {
      setLoading(true)
      const data = await getAllEmployees(currentPage, currentLimit, currentSearch)

      setEmployees(data.items || [])
      setTotalPages(data.meta.totalPages || 1)
    } catch {
      setSnack({ message: 'Failed to load employees', severity: 'error' })
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  // Central Control Station watching pagination inputs
  useEffect(() => {
    void fetchEmployees(page, limit, search)
  }, [page, limit, search])

  // Fallback to page 1 immediately ONLY when executing an intentional keyword mutation
  const handleSearchSubmit = (value: string) => {
    if (value.trim() !== search.trim()) {
      setSearch(value)
      setPage(1)
    }
  }

  const handleCreate = async () => {
    if (!formEmail.trim() || !formName.trim() || !formRate.trim()) return
    setCreating(true)
    try {
      const result = await createEmployee({
        email: formEmail.trim(),
        full_name: formName.trim(),
        hourly_rate: parseFloat(formRate),
        date_of_birth: formDob || undefined,
      })
      setCreateOpen(false)
      setFormEmail('')
      setFormName('')
      setFormRate('')
      setFormDob('')
      setGeneratedPassword(result.generated_password)
      setGeneratedFor(result.email)
      setPasswordDialogOpen(true)
      void fetchEmployees(page, limit, search)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to create employee'
      setSnack({ message: msg, severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  // Intercept reset click to mount safe metadata context panel
  const triggerResetConfirm = (emp: Employee) => {
    setEmployeeToReset(emp)
    setResetConfirmOpen(true)
  }

  // Real execution trigger for resetting user password
  const handleExecuteResetPassword = async () => {
    if (!employeeToReset) return
    try {
      setIsResetting(true)
      const result = await resetEmployeePassword(employeeToReset.employee_id)
      setResetConfirmOpen(false)
      setEmployeeToReset(null)
      setGeneratedPassword(result.generated_password)
      setGeneratedFor(result.email)
      setPasswordDialogOpen(true)
      void fetchEmployees(page, limit, search)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to reset password'
      setSnack({ message: msg, severity: 'error' })
    } finally {
      setIsResetting(false)
    }
  }

  // Intercept delete click to mount safe metadata context panel
  const triggerDeleteConfirm = (emp: Employee) => {
    setEmployeeToDelete(emp)
    setDeleteConfirmOpen(true)
  }

  // Real execution trigger for soft deactivating account
  const handleExecuteSoftDelete = async () => {
    if (!employeeToDelete) return
    try {
      setIsDeactivating(true)
      await deleteEmployee(employeeToDelete.employee_id)
      setDeleteConfirmOpen(false)
      setEmployeeToDelete(null)
      setSnack({ message: 'Employee account deactivated successfully', severity: 'success' })

      // Auto fallback page index counter index if last active data row on current page disappears
      const nextTargetPage = employees.length === 1 ? Math.max(1, page - 1) : page
      setPage(nextTargetPage)
      void fetchEmployees(nextTargetPage, limit, search)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to deactivate account'
      setSnack({ message: msg, severity: 'error' })
    } finally {
      setIsDeactivating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
    setSnack({ message: 'Copied to clipboard', severity: 'success' })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Employees
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage employee accounts
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create Employee
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ mb: 3, mt: 1 }}>
        <SearchInput
          placeholder="Search by name or email..."
          onSearch={handleSearchSubmit}
        />
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'rgba(0, 160, 157, 0.08)' }}>
              <TableCell>ID</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Full Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Loading…
                </TableCell>
              </TableRow>
            ) : (!employees || employees.length === 0) ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No employees found.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow key={emp.employee_id} hover>
                  <TableCell>{emp.employee_id}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.full_name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={emp.role}
                      color={emp.role === 'HR' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{emp.manager?.email?.split('@')[0] ?? '—'}</TableCell>
                  <TableCell>
                    {emp.must_change_password ? (
                      <Chip size="small" label="Pending Setup" color="warning" />
                    ) : (
                      <Chip size="small" label="Active" color="success" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="Reset Password">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => triggerResetConfirm(emp)}
                        >
                          <LockResetRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={emp.role === 'HR' ? "Protected HR Account" : "Deactivate Employee"}>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={emp.employee_id === profile?.employee_id || emp.role === 'HR'}
                          onClick={() => triggerDeleteConfirm(emp)}
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 3. Custom Pagination Module Layout */}
      {!loading && employees.length > 0 && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mt: 2, px: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton
              size="small"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <ChevronLeftRoundedIcon fontSize="small" />
            </IconButton>

            <Typography variant="body2" fontWeight={500} color="text.primary">
              Page {page} of {totalPages}
            </Typography>

            <IconButton
              size="small"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Rows per page:
            </Typography>
            <Select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              size="small"
              sx={{
                height: 32,
                borderRadius: '6px',
                '& .MuiSelect-select': { py: 0.5, fontSize: '0.875rem' }
              }}
            >
              <MenuItem value={1}>1</MenuItem>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
          </Stack>
        </Stack>
      )}

      {/* Confirmation Dialog: Reset Password */}
      <Dialog
        open={resetConfirmOpen}
        onClose={() => !isResetting && setResetConfirmOpen(false)}
        aria-labelledby="reset-confirm-title"
        aria-describedby="reset-confirm-description"
      >
        <DialogTitle id="reset-confirm-title">
          Confirm Password Reset
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="reset-confirm-description">
            Are you sure you want to reset the password for <strong>{employeeToReset?.full_name}</strong> ({employeeToReset?.email})? A new randomized temporary credential will be forced upon generation.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetConfirmOpen(false)} color="inherit" disabled={isResetting}>
            Cancel
          </Button>
          <Button onClick={() => void handleExecuteResetPassword()} color="warning" variant="contained" disabled={isResetting} autoFocus>
            {isResetting ? 'Resetting...' : 'Confirm Reset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog: Soft Delete Deactivation */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !isDeactivating && setDeleteConfirmOpen(false)}
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
      >
        <DialogTitle id="delete-confirm-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteRoundedIcon color="error" /> Deactivate Employee Account
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-confirm-description">
            Are you sure you want to deactivate the account for <strong>{employeeToDelete?.full_name}</strong> ({employeeToDelete?.email})?
            This operation will disable their authorization credentials and clear hardware template indices immediately, but historical timekeeping logs will remain securely preserved.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit" disabled={isDeactivating}>
            Cancel
          </Button>
          <Button onClick={() => void handleExecuteSoftDelete()} color="error" variant="contained" disabled={isDeactivating} autoFocus>
            {isDeactivating ? 'Deactivating...' : 'Confirm Deactivation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Employee Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Employee</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Email (username)"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Full Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Hourly Rate"
              type="number"
              value={formRate}
              onChange={(e) => setFormRate(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Date of Birth"
              type="date"
              value={formDob}
              onChange={(e) => setFormDob(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Manager (Approver)"
              value={profile?.email?.split('@')[0] ?? ''}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Auto-assigned to the account creator"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !formEmail.trim() || !formName.trim() || !formRate.trim()}
          >
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generated Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm">
        <DialogTitle>Account Credentials</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy this password now. It will not be shown again.
          </Alert>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Email (username):
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body1" fontFamily="monospace" fontWeight={600}>
                {generatedFor}
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(generatedFor)}>
                <ContentCopyRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Generated password:
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="h6"
                fontFamily="monospace"
                fontWeight={700}
                sx={{ bgcolor: 'grey.100', px: 2, py: 0.5, borderRadius: 1 }}
              >
                {generatedPassword}
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(generatedPassword)}>
                <ContentCopyRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setPasswordDialogOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alerts */}
      <Snackbar
        open={snack !== null}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
      >
        {snack ? (
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}