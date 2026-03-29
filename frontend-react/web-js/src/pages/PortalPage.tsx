import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import FaceRoundedIcon from '@mui/icons-material/FaceRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { Navigate, useNavigate } from 'react-router-dom'
import { PortalDashboard } from '../components/portal/PortalDashboard'
import { useAuth } from '../hooks/useAuth'

export function PortalPage() {
  const navigate = useNavigate()
  const { email, isAuthenticated, logout } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const local = email.split('@')[0]
  const welcomeName = local ? local.replace(/[._-]/g, ' ') : 'Employee'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 14% 18%, #c4efef 0%, transparent 32%), radial-gradient(circle at 86% 12%, #d8eefe 0%, transparent 28%), linear-gradient(160deg, #f7fbfb 0%, #e8f4f4 100%)',
      }}
    >
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255, 255, 255, 0.86)',
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34 }}>ST</Avatar>
          <Typography fontWeight={700} sx={{ flexGrow: 1 }}>
            SotaTek Portal
          </Typography>
          <IconButton>
            <MenuRoundedIcon />
          </IconButton>
          <Stack direction="row" spacing={1} alignItems="center">
            <FaceRoundedIcon fontSize="small" color="primary" />
            <Typography variant="body2">{welcomeName}</Typography>
          </Stack>
          <IconButton
            color="primary"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogoutRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <PortalDashboard welcomeName={welcomeName} />
    </Box>
  )
}
