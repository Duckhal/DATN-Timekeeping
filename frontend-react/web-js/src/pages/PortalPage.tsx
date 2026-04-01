import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import FaceRoundedIcon from '@mui/icons-material/FaceRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { useNavigate } from 'react-router-dom'
import { PortalDashboard } from '../components/portal/PortalDashboard'
import { useAuth } from '../hooks/useAuth'

export function PortalPage() {
  const navigate = useNavigate()
  const { profile, logout } = useAuth()
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const isUserMenuOpen = Boolean(menuAnchorEl)

  const local = profile?.email?.split('@')[0] ?? ''
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
            Portal
          </Typography>
          <IconButton>
            <MenuRoundedIcon />
          </IconButton>
          <Button
            size="small"
            onClick={(event: MouseEvent<HTMLElement>) => {
              setMenuAnchorEl(event.currentTarget)
            }}
            sx={{ textTransform: 'none' }}
          >
            <FaceRoundedIcon fontSize="small" color="primary" />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {welcomeName}
            </Typography>
          </Button>
          <Menu
            anchorEl={menuAnchorEl}
            open={isUserMenuOpen}
            onClose={() => setMenuAnchorEl(null)}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                navigate('/profile')
              }}
            >
              Profile
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                logout()
                navigate('/login', { replace: true })
              }}
            >
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <PortalDashboard welcomeName={welcomeName} />
    </Box>
  )
}
