// src/components/SearchInput.tsx
import { useState, useEffect } from 'react'
import { TextField, InputAdornment } from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'

interface SearchInputProps {
  placeholder?: string
  onSearch: (value: string) => void
}

export function SearchInput({ placeholder = 'Search...', onSearch }: SearchInputProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    // Chờ người dùng dừng gõ phím 400ms rồi mới kích hoạt gọi hàm tìm kiếm
    const timer = setTimeout(() => {
      onSearch(value)
    }, 400)

    return () => clearTimeout(timer)
  }, [value, onSearch])

  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchRoundedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          </InputAdornment>
        ),
      }}
      sx={{
        width: '100%',
        maxWidth: 400,
        bgcolor: 'background.paper',
        borderRadius: 1,
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
        },
      }}
    />
  );
}