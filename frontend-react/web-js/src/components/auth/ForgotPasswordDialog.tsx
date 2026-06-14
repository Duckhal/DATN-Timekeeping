import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'

type ForgotPasswordDialogProps = {
  open: boolean
  onClose: () => void
  onSubmit: (email: string) => void
}

export function ForgotPasswordDialog({
  open,
  onClose,
  onSubmit,
}: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState('')

  const handleClose = () => {
    setEmail('')
    onClose()
  }

  const handleSubmit = () => {
    onSubmit(email)
    setEmail('')
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Forgot Password</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Recovery Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!email.trim()}
        >
          Send Request
        </Button>
      </DialogActions>
    </Dialog>
  )
}
