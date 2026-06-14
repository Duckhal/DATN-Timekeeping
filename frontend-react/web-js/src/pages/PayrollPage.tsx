import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import { getPayrollPdf, getPayrollRecord } from '../apis/payrollService'
import type { PayrollRecord } from '../types/payroll'
import { getApiErrorMessage } from '../utils/getApiErrorMessage'

function formatVnd(value: string): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export function PayrollPage() {
  const { payrollId } = useParams()
  const numericPayrollId = Number(payrollId)
  const [record, setRecord] = useState<PayrollRecord | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filename = useMemo(() => {
    if (!record) return 'payroll.pdf'
    return `payroll-${record.month_year}-employee-${record.employee_id}.pdf`
  }, [record])

  useEffect(() => {
    let revokedUrl: string | null = null

    async function loadPayroll() {
      if (!Number.isInteger(numericPayrollId) || numericPayrollId <= 0) {
        setError('Invalid payroll link.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [nextRecord, pdfBlob] = await Promise.all([
          getPayrollRecord(numericPayrollId),
          getPayrollPdf(numericPayrollId),
        ])
        const nextUrl = URL.createObjectURL(pdfBlob)
        revokedUrl = nextUrl
        setRecord(nextRecord)
        setPdfUrl(nextUrl)
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to load payroll.'))
        setRecord(null)
        setPdfUrl(null)
      } finally {
        setLoading(false)
      }
    }

    void loadPayroll()

    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [numericPayrollId])

  return (
    <Box sx={{ px: { xs: 0, md: 1 }, py: 1 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Payroll
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View monthly payroll statement
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {loading ? (
          <Paper sx={{ p: 5, textAlign: 'center' }} variant="outlined">
            <CircularProgress />
          </Paper>
        ) : record && pdfUrl ? (
          <>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
                spacing={2}
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {record.employee.full_name} - {record.month_year}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Actual hours: {record.actual_hours} | Hourly rate:{' '}
                    {formatVnd(record.hourly_rate)} | Salary:{' '}
                    {formatVnd(record.salary_amount)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    startIcon={<OpenInNewRoundedIcon />}
                    onClick={() => window.open(pdfUrl, '_blank', 'noopener')}
                  >
                    Open
                  </Button>
                  <Button
                    component="a"
                    href={pdfUrl}
                    download={filename}
                    variant="contained"
                    startIcon={<FileDownloadRoundedIcon />}
                  >
                    Download
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Paper
              variant="outlined"
              sx={{
                height: { xs: '70vh', md: '78vh' },
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Box
                component="iframe"
                src={pdfUrl}
                title={filename}
                sx={{
                  border: 0,
                  width: '100%',
                  height: '100%',
                  display: 'block',
                }}
              />
            </Paper>
          </>
        ) : null}
      </Stack>
    </Box>
  )
}
