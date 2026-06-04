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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { useNavigate } from 'react-router-dom'
import {
  createEmployee,
  getAllEmployees,
  resetEmployeePassword,
} from '../apis/employeeService'
import { useAuth } from '../hooks/useAuth'
import type { Employee } from '../types/auth'

export function EmployeesPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formRate, setFormRate] = useState('')
  const [formDob, setFormDob] = useState('')
  const [creating, setCreating] = useState(false)

  // Generated password display
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [generatedFor, setGeneratedFor] = useState('')
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  // Snackbar
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getAllEmployees()
      setEmployees(data)
    } catch {
      setSnack({ message: 'Failed to load employees', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEmployees()
  }, [fetchEmployees])

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
      void fetchEmployees()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to create employee'
      setSnack({ message: msg, severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleResetPassword = async (emp: Employee) => {
    try {
      const result = await resetEmployeePassword(emp.employee_id)
      setGeneratedPassword(result.generated_password)
      setGeneratedFor(result.email)
      setPasswordDialogOpen(true)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to reset password'
      setSnack({ message: msg, severity: 'error' })
    }
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
    setSnack({ message: 'Copied to clipboard', severity: 'success' })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
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

      <TableContainer component={Paper}>
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
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  Loading…
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
                    <Tooltip title="Reset Password">
                      <IconButton
                        size="small"
                        onClick={() => handleResetPassword(emp)}
                      >
                        <LockResetRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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

      {/* Snackbar */}
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
