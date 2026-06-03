import { PortalDashboard } from '../components/portal/PortalDashboard'
import { useAuth } from '../hooks/useAuth'

export function PortalPage() {
  const { profile } = useAuth()
  
  const local = profile?.email?.split('@')[0] ?? ''
  const welcomeName = local ? local.replace(/[._-]/g, ' ') : 'Employee'

  return <PortalDashboard welcomeName={welcomeName} />
}
