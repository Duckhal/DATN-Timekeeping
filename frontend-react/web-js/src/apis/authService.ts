import apiClient from './axios'
import type { Employee, LoginRequest, LoginResponse } from '../types/auth'

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', payload)
  return response.data
}

export async function getMe(): Promise<Employee> {
  const response = await apiClient.get<Employee>('/auth/me')
  return response.data
}
