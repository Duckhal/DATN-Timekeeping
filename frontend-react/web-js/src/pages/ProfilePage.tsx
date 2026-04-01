import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { getMe } from '../apis/auth.service'
import type { Employee } from '../types/auth'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  )
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true)
        const data = await getMe()
        setProfile(data)
      } catch {
        setError('Unable to load profile data.')
      } finally {
        setIsLoading(false)
      }
    }

    void run()
  }, [])

  const initials = useMemo(() => {
    if (!profile?.full_name) {
      return 'U'
    }

    const chunks = profile.full_name.trim().split(/\s+/)
    return chunks.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
  }, [profile])

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {isLoading ? (
        <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
          <CircularProgress color="primary" />
        </Box>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {profile && !isLoading ? (
        <Card sx={{ maxWidth: 920, mx: 'auto' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>{initials}</Avatar>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {profile.full_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Employee ID: {profile.employee_id}
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gap: 3,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                },
              }}
            >
              <Box>
                <Field label="Email" value={profile.email} />
              </Box>
              <Box>
                <Field label="Role" value={profile.role} />
              </Box>
              <Box>
                <Field label="Date of Birth" value={new Date(profile.date_of_birth).toLocaleDateString()} />
              </Box>
              <Box>
                <Field label="Hourly Rate" value={profile.hourly_rate} />
              </Box>
              <Box>
                <Field label="RFID Tag" value={profile.rfid_tag ?? '-'} />
              </Box>
              <Box>
                <Field label="Fingerprint ID" value={profile.fingerprint_id ?? '-'} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  )
}
