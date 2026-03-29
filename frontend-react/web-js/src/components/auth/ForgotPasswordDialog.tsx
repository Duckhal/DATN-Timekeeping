import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!open) {
      setEmail('')
    }
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onSubmit(email)}
          variant="contained"
          disabled={!email.trim()}
        >
          Send Request
        </Button>
      </DialogActions>
    </Dialog>
  )
}
