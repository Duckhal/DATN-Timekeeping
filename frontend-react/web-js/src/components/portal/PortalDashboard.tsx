import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded'
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import WorkHistoryRoundedIcon from '@mui/icons-material/WorkHistoryRounded'
import { attendanceRecords, quickActions } from '../../utils/portalData'

type PortalDashboardProps = {
  welcomeName: string
}

export function PortalDashboard({ welcomeName }: PortalDashboardProps) {
  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            background:
              'linear-gradient(105deg, rgba(0,160,157,0.18), rgba(0,95,115,0.08))',
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Hello, {welcomeName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Attendance Summary - March 2026
          </Typography>
        </Paper>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          divider={<Divider orientation="vertical" flexItem />}
        >
          {quickActions.map((item) => (
            <Button
              key={item.label}
              variant="outlined"
              startIcon={item.icon}
              sx={{
                flex: 1,
                py: 1.25,
                borderColor: 'rgba(0, 160, 157, 0.4)',
                color: 'secondary.main',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Card sx={{ flex: 1, bgcolor: '#e0f3f2' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Leave Balance</Typography>
                <PendingActionsRoundedIcon color="primary" />
              </Stack>
              <Typography variant="h4" fontWeight={700} mt={1}>
                0.0
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Remaining this month
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, bgcolor: '#dff1fd' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Leave Requests</Typography>
                <EventBusyRoundedIcon color="info" />
              </Stack>
              <Typography variant="h4" fontWeight={700} mt={1}>
                0
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending approval
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              Recent Attendance Logs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mock data inspired by the SotaTek Portal layout
            </Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(0, 160, 157, 0.08)' }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Work Start</TableCell>
                  <TableCell>Work End</TableCell>
                  <TableCell>Check in</TableCell>
                  <TableCell>Check out</TableCell>
                  <TableCell>Missing Minutes</TableCell>
                  <TableCell>Total Workday</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attendanceRecords.map((item) => (
                  <TableRow key={item.date} hover>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{item.workStart}</TableCell>
                    <TableCell>{item.workEnd}</TableCell>
                    <TableCell>{item.checkIn}</TableCell>
                    <TableCell>{item.checkOut}</TableCell>
                    <TableCell>{item.missingMinutes}</TableCell>
                    <TableCell>{item.totalWorkday.toFixed(4)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.status}
                        color={
                          item.status === 'Complete'
                            ? 'success'
                            : item.status === 'Day Off'
                              ? 'default'
                              : 'warning'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Quick Actions
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <ScheduleRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="View detailed attendance by date" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <WorkHistoryRoundedIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary="Submit a personal profile update request" />
            </ListItem>
          </List>
        </Paper>
      </Stack>
    </Box>
  )
}
