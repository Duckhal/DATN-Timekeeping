import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Modal,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'

type LoginModalProps = {
  open: boolean
  error: string
  isLoading: boolean
  onLogin: (email: string, password: string) => Promise<void>
  onForgotPassword: () => void
}

export function LoginModal({
  open,
  error,
  isLoading,
  onLogin,
  onForgotPassword,
}: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onLogin(email, password)
  }

  return (
    <Modal open={open}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          px: 2,
        }}
      >
        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 24px 48px rgba(0, 60, 70, 0.16)',
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Sign In
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Access the Timekeeping System
              </Typography>
            </Box>

            <TextField
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              fullWidth
            />

            <TextField
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? 'text' : 'password'}
              required
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowPassword((prev) => !prev)}
                        onMouseDown={(event) => event.preventDefault()}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {error ? <Alert severity="warning">{error}</Alert> : null}

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Link
                component="button"
                type="button"
                onClick={onForgotPassword}
                underline="hover"
                disabled={isLoading}
              >
                Forgot password?
              </Link>
              <Button type="submit" variant="contained" size="large" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Modal>
  )
}
