import apiClient from './axios'
import type { AttendancePage, AttendanceQuery } from '../types/attendance'

export async function getMyAttendance(
  query: AttendanceQuery = {},
): Promise<AttendancePage> {
  const params: Record<string, string | number> = {}
  if (query.month) params.month = query.month
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  if (query.page) params.page = query.page
  if (query.pageSize) params.pageSize = query.pageSize

  const response = await apiClient.get<AttendancePage>('/attendance/me', {
    params,
  })
  return response.data
}
