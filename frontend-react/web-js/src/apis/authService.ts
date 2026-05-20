import apiClient from './axios'
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  Employee,
  LoginRequest,
  LoginResponse,
} from '../types/auth'

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', payload)
  return response.data
}

export async function getMe(): Promise<Employee> {
  const response = await apiClient.get<Employee>('/auth/me')
  return response.data
}

export async function changePassword(
  payload: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  const response = await apiClient.post<ChangePasswordResponse>(
    '/auth/change-password',
    payload,
  )
  return response.data
}
