import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Badge,
  Popover,
  Divider,
  Stack,
} from '@mui/material'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import FaceRoundedIcon from '@mui/icons-material/FaceRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'

import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../contexts/NotificationContext'

const DRAWER_WIDTH = 260

export function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, logout } = useAuth()
  const { unreadCount, notifications, handleMarkAsRead, handleMarkAllAsRead } = useNotifications()

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null)
  const isUserMenuOpen = Boolean(menuAnchorEl)

  const local = profile?.email?.split('@')[0] ?? ''
  const welcomeName = local ? local.replace(/[._-]/g, ' ') : 'Employee'

  const menuItems = [
    { label: 'Portal', path: '/portal', icon: <HomeRoundedIcon /> },
    ...(profile?.role === 'HR' ? [
      { label: 'Employees', path: '/employees', icon: <PeopleAltRoundedIcon /> },
      { label: 'Devices', path: '/devices', icon: <DevicesRoundedIcon /> },
      { label: 'Authentication', path: '/credentials', icon: <VpnKeyRoundedIcon /> },
      { label: 'Approvals', path: '/approvals', icon: <FactCheckRoundedIcon /> },
    ] : []),
    { label: 'My Requests', path: '/requests', icon: <AssessmentRoundedIcon /> },
  ]

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8F9FB' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: 'none',
            bgcolor: '#FFFFFF',
            boxShadow: '1px 0px 10px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            T
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.5px' }}>
            Timekeeping
          </Typography>
        </Box>

        <Box sx={{ px: 2, flex: 1 }}>
          <List sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
            {menuItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: '10px',
                      mb: 0.5,
                      bgcolor: isActive ? '#4C4DDC' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#64748B',
                      '&:hover': {
                        bgcolor: isActive ? '#4344C8' : '#F1F5F9',
                      },
                      transition: 'all 0.2s',
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: isActive ? '#FFFFFF' : '#64748B',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label} 
                      primaryTypographyProps={{ 
                        fontWeight: isActive ? 600 : 500,
                        fontSize: '0.9rem' 
                      }} 
                    />
                  </ListItemButton>
                </ListItem>
              )
            })}
          </List>
        </Box>

        <Box sx={{ p: 2 }}>
          <Box sx={{ p: 2, bgcolor: '#F8F9FA', borderRadius: '12px', display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Box sx={{ color: 'primary.main' }}>
              <HelpOutlineRoundedIcon />
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={600} fontSize="0.85rem">
                Need help?
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Check our docs
              </Typography>
            </Box>
          </Box>
        </Box>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Box sx={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end', 
          px: 4,
          bgcolor: '#FFFFFF',
          borderBottom: '1px solid',
          borderColor: 'divider',
          gap: 2
        }}>
          <IconButton onClick={(e) => setNotifAnchorEl(e.currentTarget)}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsRoundedIcon sx={{ color: '#64748B' }} />
            </Badge>
          </IconButton>
          
          <Box 
            onClick={(e) => setMenuAnchorEl(e.currentTarget)}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5, 
              cursor: 'pointer',
              pl: 1
            }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#4C4DDC', fontSize: '0.875rem' }}>
              {welcomeName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                {welcomeName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {profile?.role ?? 'Employee'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
          <Outlet />
        </Box>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={isUserMenuOpen}
        onClose={() => setMenuAnchorEl(null)}
        PaperProps={{ sx: { minWidth: 150, mt: 1, boxShadow: '0px 4px 20px rgba(0,0,0,0.08)' } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { setMenuAnchorEl(null); navigate('/profile') }}>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchorEl(null); logout(); navigate('/login', { replace: true }) }}>
          Log out
        </MenuItem>
      </Menu>

      {/* Notifications Popover */}
      <Popover
        open={Boolean(notifAnchorEl)}
        anchorEl={notifAnchorEl}
        onClose={() => setNotifAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { mt: 1, borderRadius: 2, boxShadow: '0px 4px 20px rgba(0,0,0,0.08)' } }}
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
    </Box>
  )
}
