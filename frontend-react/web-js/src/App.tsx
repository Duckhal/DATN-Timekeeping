import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { PortalPage } from './pages/PortalPage'
import { ProfilePage } from './pages/ProfilePage'
import { DevicesPage } from './pages/DevicesPage'
import { CredentialsPage } from './pages/CredentialsPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { RequestsPage } from './pages/RequestsPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { AppThemeProvider } from './providers/theme/AppThemeProvider'

function App() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/portal" element={<PortalPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/devices" element={<DevicesPage />} />
                <Route path="/credentials" element={<CredentialsPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/requests" element={<RequestsPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/change-password" element={<ChangePasswordPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </AppThemeProvider>
  )
}

export default App
