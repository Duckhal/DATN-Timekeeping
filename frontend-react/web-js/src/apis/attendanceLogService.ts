import apiClient from './axios'
import type {
  AllAttendancePage,
  AllAttendanceQuery,
  AttendanceSummaryResponse,
} from '../types/attendance'

export async function getAllAttendanceLogs(
  query: AllAttendanceQuery = {},
): Promise<AllAttendancePage> {
  const params: Record<string, string | number> = {}
  if (query.month) params.month = query.month
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  if (query.search) params.search = query.search
  if (query.page) params.page = query.page
  if (query.pageSize) params.pageSize = query.pageSize

  const response = await apiClient.get<AllAttendancePage>('/attendance/all', {
    params,
  })
  return response.data
}

// HR — monthly aggregate (total missing_minutes + total_workday)
export async function getAttendanceSummary(
  query: AllAttendanceQuery = {},
): Promise<AttendanceSummaryResponse> {
  const params: Record<string, string | number> = {}
  if (query.month) params.month = query.month
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  if (query.search) params.search = query.search

  const response = await apiClient.get<AttendanceSummaryResponse>(
    '/attendance/all/summary',
    { params },
  )
  return response.data
}
