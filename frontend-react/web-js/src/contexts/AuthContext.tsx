import { createContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { AxiosError } from 'axios'
import { AUTH_TOKEN_KEY } from '../apis/axios'
import { getMe, login as loginRequest } from '../apis/authService'
import type { Employee } from '../types/auth'

type LoginResult = {
  ok: boolean
  message?: string
  mustChangePassword?: boolean
}

type AuthContextValue = {
  isBootstrapping: boolean
  isAuthenticated: boolean
  requiresPasswordChange: boolean
  profile: Employee | null
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => void
  onPasswordChanged: (token: string, user: Employee) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)
  const [profile, setProfile] = useState<Employee | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)

    if (!token) {
      setIsBootstrapping(false)
      return
    }

    const bootstrap = async () => {
      try {
        const me = await getMe()
        setProfile(me)
        setIsAuthenticated(true)
        if (me.must_change_password) {
          setRequiresPasswordChange(true)
        }
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        setProfile(null)
        setIsAuthenticated(false)
      } finally {
        setIsBootstrapping(false)
      }
    }

    void bootstrap()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isBootstrapping,
      isAuthenticated,
      requiresPasswordChange,
      profile,
      login: async (nextEmail: string, password: string) => {
        if (!nextEmail.trim() || !password.trim()) {
          return {
            ok: false,
            message: 'Please enter both email and password.',
          }
        }

        try {
          const response = await loginRequest({
            email: nextEmail.trim(),
            password,
          })

          localStorage.setItem(AUTH_TOKEN_KEY, response.access_token)

          if (response.must_change_password) {
            setRequiresPasswordChange(true)
            setIsAuthenticated(true)
            setProfile(null)
            return { ok: true, mustChangePassword: true }
          }

          setProfile(response.user as Employee)
          setIsAuthenticated(true)
          setRequiresPasswordChange(false)

          return { ok: true }
        } catch (error) {
          const maybeAxiosError = error as AxiosError<{ message?: string }>
          const backendMessage = maybeAxiosError.response?.data?.message

          if (typeof backendMessage === 'string' && backendMessage.length > 0) {
            return { ok: false, message: backendMessage }
          }

          if (!maybeAxiosError.response) {
            return {
              ok: false,
              message:
                'Cannot connect to server. Please check backend and CORS settings.',
            }
          }

          return { ok: false, message: 'Login failed. Please try again.' }
        }
      },
      logout: () => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        setProfile(null)
        setIsAuthenticated(false)
        setRequiresPasswordChange(false)
      },
      onPasswordChanged: (token: string, user: Employee) => {
        localStorage.setItem(AUTH_TOKEN_KEY, token)
        setProfile(user)
        setIsAuthenticated(true)
        setRequiresPasswordChange(false)
      },
    }),
    [isAuthenticated, isBootstrapping, profile, requiresPasswordChange],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
