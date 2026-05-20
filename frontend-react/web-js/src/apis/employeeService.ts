import apiClient from './axios'
import type {
  CreateEmployeeRequest,
  CreateEmployeeResponse,
  Employee,
  ResetPasswordResponse,
} from '../types/auth'

export async function getAllEmployees(): Promise<Employee[]> {
  const response = await apiClient.get<Employee[]>('/employees')
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
