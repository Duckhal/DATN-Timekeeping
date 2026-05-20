import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { changePassword } from '../apis/authService'
import { AxiosError } from 'axios'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { onPasswordChanged } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setError('')
    setIsLoading(true)

    try {
      const result = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      onPasswordChanged(result.access_token, result.user)
      navigate('/portal', { replace: true })
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>
      const msg = axiosErr.response?.data?.message
      setError(typeof msg === 'string' ? msg : 'Failed to change password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at 14% 18%, #c4efef 0%, transparent 32%), radial-gradient(circle at 86% 12%, #d8eefe 0%, transparent 28%), linear-gradient(160deg, #f7fbfb 0%, #e8f4f4 100%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} component="form" onSubmit={handleSubmit}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LockResetRoundedIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Change Password
              </Typography>
            </Stack>

            <Alert severity="info" variant="outlined">
              You must change your password before continuing. Please set a new
              password that is at least 8 characters long.
            </Alert>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Current Password"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowCurrent((v) => !v)}
                    >
                      {showCurrent ? (
                        <VisibilityOffRoundedIcon fontSize="small" />
                      ) : (
                        <VisibilityRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="New Password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              fullWidth
              helperText={
                newPassword.length > 0 && newPassword.length < 8
                  ? 'Must be at least 8 characters'
                  : newPassword === currentPassword && newPassword.length > 0
                    ? 'Must be different from current password'
                    : undefined
              }
              error={
                (newPassword.length > 0 && newPassword.length < 8) ||
                (newPassword === currentPassword && newPassword.length > 0)
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowNew((v) => !v)}
                    >
                      {showNew ? (
                        <VisibilityOffRoundedIcon fontSize="small" />
                      ) : (
                        <VisibilityRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
              helperText={
                confirmPassword.length > 0 && confirmPassword !== newPassword
                  ? 'Passwords do not match'
                  : undefined
              }
              error={
                confirmPassword.length > 0 && confirmPassword !== newPassword
              }
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!isValid || isLoading}
              fullWidth
            >
              {isLoading ? 'Changing…' : 'Change Password'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
