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
  Paper,
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
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
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
import { getApiErrorMessage } from '../utils/getApiErrorMessage'

const PAGE_SIZE_OPTIONS = [1, 10, 20, 50, 100] as const

function formatRole(role: Employee['role']): string {
  return role === 'MANAGER' ? 'Manager' : 'Employee'
}

export function EmployeesPage() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // 1. Pagination and Remote Search State Configurations
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)   // MUI TablePagination is 0-indexed
  const [limit, setLimit] = useState(20) // Standard safe default record count
  const [total, setTotal] = useState(0)  // Total record count for pagination

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
      const data = await getAllEmployees(currentPage + 1, currentLimit, currentSearch)

      setEmployees(data.items || [])
      setTotal(data.meta.total || 0)
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
      setPage(0)
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
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(err, 'Failed to create employee'),
        severity: 'error',
      })
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
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(err, 'Failed to reset password'),
        severity: 'error',
      })
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
      const nextTargetPage = employees.length === 1 ? Math.max(0, page - 1) : page
      setPage(nextTargetPage)
      void fetchEmployees(nextTargetPage, limit, search)
    } catch (err: unknown) {
      setSnack({
        message: getApiErrorMessage(err, 'Failed to deactivate account'),
        severity: 'error',
      })
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
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Loading…
                </TableCell>
              </TableRow>
            ) : (!employees || employees.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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
                      label={formatRole(emp.role)}
                      color={emp.role === 'MANAGER' ? 'primary' : 'default'}
                    />
                  </TableCell>
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
                      <Tooltip title={emp.role === 'MANAGER' ? "Protected Manager Account" : "Deactivate Employee"}>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={emp.employee_id === profile?.employee_id || emp.role === 'MANAGER'}
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
