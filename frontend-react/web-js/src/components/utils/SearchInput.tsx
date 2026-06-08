// src/components/utils/SearchInput.tsx
import { useEffect, useRef, useState } from 'react'
import { TextField, InputAdornment } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'

interface SearchInputProps {
  placeholder?: string
  onSearch: (value: string) => void
  /** Debounce delay in ms before firing onSearch. Defaults to 300ms. */
  debounceMs?: number
  /** Initial text value of the field. */
  initialValue?: string
  /** Extra styles merged onto the TextField. */
  sx?: SxProps<Theme>
}

/**
 * Debounced search field shared across list pages (Attendance, Employees,
 * Credentials). Holds its own input value and only notifies the parent via
 * onSearch after the user stops typing for `debounceMs`.
 */
export function SearchInput({
  placeholder = 'Search…',
  onSearch,
  debounceMs = 300,
  initialValue = '',
  sx,
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue)

  // Keep the latest onSearch in a ref so parent re-renders (new callback
  // identity each render) don't re-arm the debounce timer.
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current(value)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [value, debounceMs])

  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
            </InputAdornment>
          ),
        },
      }}
      sx={{ minWidth: 280, maxWidth: 360, ...sx }}
    />
  )
}
