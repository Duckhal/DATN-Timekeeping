import { createContext } from 'react'
import type { Employee } from '../types/auth'

export type LoginResult = {
  ok: boolean
  message?: string
  mustChangePassword?: boolean
}

export type AuthContextValue = {
  isBootstrapping: boolean
  isAuthenticated: boolean
  requiresPasswordChange: boolean
  profile: Employee | null
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => void
  onPasswordChanged: (token: string, user: Employee) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
