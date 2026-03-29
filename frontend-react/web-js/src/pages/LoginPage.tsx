import { useState } from 'react'
import { Alert, Box, Snackbar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { ForgotPasswordDialog } from '../components/auth/ForgotPasswordDialog'
import { LoginModal } from '../components/auth/LoginModal'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [error, setError] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [snackOpen, setSnackOpen] = useState(false)

  const handleLogin = (email: string, password: string) => {
    const result = login(email, password)

    if (!result.ok) {
      setError(result.message ?? 'Sign-in failed.')
      return
    }

    setError('')
    navigate('/portal', { replace: true })
  }

  const handleForgotPassword = (email: string) => {
    if (!email.trim()) {
      return
    }

    setForgotOpen(false)
    setSnackOpen(true)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 14% 18%, #c4efef 0%, transparent 32%), radial-gradient(circle at 86% 12%, #d8eefe 0%, transparent 28%), linear-gradient(160deg, #f7fbfb 0%, #e8f4f4 100%)',
      }}
    >
      <LoginModal
        open
        error={error}
        onLogin={handleLogin}
        onForgotPassword={() => setForgotOpen(true)}
      />

      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        onSubmit={handleForgotPassword}
      />

      <Snackbar
        open={snackOpen}
        autoHideDuration={3500}
        onClose={() => setSnackOpen(false)}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackOpen(false)}>
          Password recovery instructions have been sent to your email.
        </Alert>
      </Snackbar>
    </Box>
  )
}
