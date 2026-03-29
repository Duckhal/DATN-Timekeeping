import { createContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

type LoginResult = {
  ok: boolean
  message?: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  email: string
  login: (email: string, password: string) => LoginResult
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      email,
      login: (nextEmail: string, password: string) => {
        if (!nextEmail.trim() || !password.trim()) {
          return {
            ok: false,
            message: 'Please enter both email and password.',
          }
        }

        setEmail(nextEmail)
        setIsAuthenticated(true)

        return { ok: true }
      },
      logout: () => {
        setEmail('')
        setIsAuthenticated(false)
      },
    }),
    [email, isAuthenticated],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
