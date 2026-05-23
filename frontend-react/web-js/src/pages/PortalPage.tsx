import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Toolbar,
  Typography,
} from '@mui/material'
import FaceRoundedIcon from '@mui/icons-material/FaceRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import { useNavigate } from 'react-router-dom'
import { PortalDashboard } from '../components/portal/PortalDashboard'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../contexts/NotificationContext'

export function PortalPage() {
  const navigate = useNavigate()
  const { profile, logout } = useAuth()
  const { unreadCount, notifications, handleMarkAsRead, handleMarkAllAsRead } = useNotifications()
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null)
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
          {profile?.role === 'HR' ? (
            <>
              <Button size="small" onClick={() => navigate('/employees')} sx={{ textTransform: 'none' }}>
                Employees
              </Button>
              <Button size="small" onClick={() => navigate('/devices')} sx={{ textTransform: 'none' }}>
                Devices
              </Button>
              <Button size="small" onClick={() => navigate('/credentials')} sx={{ textTransform: 'none' }}>
                Credentials
              </Button>
              <Button size="small" onClick={() => navigate('/approvals')} sx={{ textTransform: 'none' }}>
                Approvals
              </Button>
            </>
          ) : null}
          <Button size="small" onClick={() => navigate('/requests')} sx={{ textTransform: 'none' }}>
            My Requests
          </Button>
          <IconButton onClick={(e) => setNotifAnchorEl(e.currentTarget)}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsRoundedIcon />
            </Badge>
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
          <Popover
            open={Boolean(notifAnchorEl)}
            anchorEl={notifAnchorEl}
            onClose={() => setNotifAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ width: 340, maxHeight: 400, overflow: 'auto' }}>
              <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={600} variant="subtitle1">Notifications</Typography>
                {unreadCount > 0 && (
                  <Button size="small" onClick={() => { void handleMarkAllAsRead() }}>
                    Mark all read
                  </Button>
                )}
              </Box>
              <Divider />
              {notifications.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No notifications
                </Typography>
              ) : (
                <List disablePadding>
                  {notifications.map((n) => (
                    <ListItemButton
                      key={n.notification_id}
                      sx={{ bgcolor: n.is_read ? 'transparent' : 'action.hover' }}
                      onClick={() => { void handleMarkAsRead(n.notification_id) }}
                    >
                      <ListItemText
                        primary={n.title}
                        secondary={n.content ?? new Date(n.created_at).toLocaleString()}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: n.is_read ? 400 : 600 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          </Popover>
        </Toolbar>
      </AppBar>

      <PortalDashboard welcomeName={welcomeName} />
    </Box>
  )
}
