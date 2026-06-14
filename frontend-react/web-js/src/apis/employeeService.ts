import apiClient from './axios'
import type {
  CreateEmployeeRequest,
  CreateEmployeeResponse,
  Employee,
  ResetPasswordResponse,
} from '../types/auth'

export interface PaginatedEmployees {
  items: Employee[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getAllEmployees(
  page: number,
  limit: number,
  search: string,
): Promise<PaginatedEmployees> {
  const response = await apiClient.get<PaginatedEmployees>('/employees', {
    params: { page, limit, search },
  })
  return response.data
}

export async function createEmployee(
  payload: CreateEmployeeRequest,
): Promise<CreateEmployeeResponse> {
  const response = await apiClient.post<CreateEmployeeResponse>(
    '/employees',
    payload,
  )
  return response.data
}

export async function resetEmployeePassword(
  id: number,
): Promise<ResetPasswordResponse> {
  const response = await apiClient.patch<ResetPasswordResponse>(
    `/employees/${id}/reset-password`,
  )
  return response.data
}

export async function deleteEmployee(id: number): Promise<unknown> {
  const response = await apiClient.delete<unknown>(`/employees/${id}`)
  return response.data
}
