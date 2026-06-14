import apiClient from './axios'
import type { PayrollRecord, PublishPayrollResponse } from '../types/payroll'

export async function publishPayroll(
  month: string,
): Promise<PublishPayrollResponse> {
  const response = await apiClient.post<PublishPayrollResponse>(
    '/payroll/publish',
    { month },
    { timeout: 60000 },
  )
  return response.data
}

export async function getPayrollRecord(id: number): Promise<PayrollRecord> {
  const response = await apiClient.get<PayrollRecord>(`/payroll/${id}`)
  return response.data
}

export async function getPayrollPdf(id: number): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/payroll/${id}/pdf`, {
    responseType: 'blob',
    timeout: 60000,
  })
  return response.data
}
