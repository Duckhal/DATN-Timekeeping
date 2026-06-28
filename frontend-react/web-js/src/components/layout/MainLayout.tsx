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
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'

import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import type { NotificationItem } from '../../types/notification'

const DRAWER_WIDTH = 260

function getPayrollId(notification: NotificationItem): number | null {
  if (notification.type !== 'PAYROLL') return null
  if (typeof notification.reference_id === 'number') {
    return notification.reference_id
  }

  if (!notification.metadata) return null

  try {
    const metadata = JSON.parse(notification.metadata) as {
      payroll_id?: unknown
    }
    return typeof metadata.payroll_id === 'number' ? metadata.payroll_id : null
  } catch {
    return null
  }
}

export function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { profile, logout } = useAuth()
  const { unreadCount, notifications, handleMarkAsRead, handleMarkAllAsRead } = useNotifications()

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false) 

  const isUserMenuOpen = Boolean(menuAnchorEl)
  const local = profile?.email?.split('@')[0] ?? ''
  const welcomeName = local ? local.replace(/[._-]/g, ' ') : 'Employee'

  const menuItems = [
    { label: 'Portal', path: '/portal', icon: <HomeRoundedIcon /> },
    ...(profile?.role === 'MANAGER' ? [
      { label: 'Employees', path: '/employees', icon: <PeopleAltRoundedIcon /> },
      { label: 'Devices', path: '/devices', icon: <DevicesRoundedIcon /> },
      { label: 'Authentication', path: '/credentials', icon: <VpnKeyRoundedIcon /> },
      { label: 'Approvals', path: '/approvals', icon: <FactCheckRoundedIcon /> },
      { label: 'Attendance Log', path: '/attendance-log', icon: <EventNoteRoundedIcon /> },
    ] : [
      { label: 'My Requests', path: '/requests', icon: <AssessmentRoundedIcon /> },
    ]),
  ]

  const handleNotificationClick = (notification: NotificationItem) => {
    void (async () => {
      try {
        await handleMarkAsRead(notification.notification_id)
      } catch (error) {
        console.error('Failed to mark notification as read', error)
      }

      const payrollId = getPayrollId(notification)
      if (payrollId !== null) {
        setNotifAnchorEl(null)
        navigate(`/payroll/${payrollId}`)
      }
    })()
  }

  // Sidebar content (logo + menu + help box)
  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Logo */}
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

      {/* Danh sách Menu điều hướng */}
      <Box sx={{ px: 2, flex: 1 }}>
        <List sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  onClick={() => {
                    navigate(item.path)
                    if (isMobile) setMobileOpen(false)
                  }}
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
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8F9FB' }}>
      
      {/* Responsive Drawer (Sidebar) */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 'none',
              boxShadow: '4px 0px 20px rgba(0,0,0,0.05)',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 'none',
              bgcolor: '#FFFFFF',
              boxShadow: '1px 0px 10px rgba(0,0,0,0.02)',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* 2. Topbar */}
        <Box sx={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          px: { xs: 2, md: 4 },
          bgcolor: '#FFFFFF',
          borderBottom: '1px solid',
          borderColor: 'divider',
          gap: 2
        }}>
          {/* Menu Button */}
          {isMobile ? (
            <IconButton onClick={() => setMobileOpen(true)} sx={{ color: '#64748B' }}>
              <MenuRoundedIcon />
            </IconButton>
          ) : (
            <Box />
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
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
              
              {/* User Info */}
              {!isMobile && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                    {welcomeName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {profile?.role === 'MANAGER' ? 'Manager' : 'Employee'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>

      {/* User Menu Dropdown */}
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
        <Box sx={{ width: { xs: 280, sm: 340 }, maxHeight: 400, overflow: 'auto' }}>
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
                  onClick={() => handleNotificationClick(n)}
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
