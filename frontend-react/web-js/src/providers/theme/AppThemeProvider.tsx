import type { PropsWithChildren } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

const appTheme = createTheme({
  palette: {
    primary: { main: '#00a09d' },
    secondary: { main: '#005f73' },
    background: {
      default: '#f2f8f8',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Be Vietnam Pro", "Segoe UI", sans-serif',
  },
  shape: {
    borderRadius: 14,
  },
})

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
