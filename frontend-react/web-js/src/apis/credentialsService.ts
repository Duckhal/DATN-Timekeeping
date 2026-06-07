import apiClient from './axios'
import type {
  AssignRfidPayload,
  CredentialType,
  StartEnrollResponse,
  UnassignedCredentialEmployee,
} from '../types/credentials'
import type { Device } from '../types/device'

// 1. Defined the safe pagination wrapper mapping the backend metadata scheme
export interface PaginatedCredentials {
  items: UnassignedCredentialEmployee[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// 2. Updated the function parameter signatures to accept query criteria variables
export async function getUnassignedCredentialEmployees(
  page: number,
  limit: number,
  search: string,
): Promise<PaginatedCredentials> {
  const response = await apiClient.get<PaginatedCredentials>('/employees/unassigned-credentials', {
    params: { page, limit, search },
  })
  return response.data
}

export async function attachRfidCard(
  employeeId: number, 
  payload: AssignRfidPayload
): Promise<UnassignedCredentialEmployee> {
  const response = await apiClient.patch<UnassignedCredentialEmployee>(
    `/employees/${employeeId}/credentials/rfid`, 
    payload
  )
  return response.data
}

export async function removeCredential(
  employeeId: number, 
  type: CredentialType
): Promise<UnassignedCredentialEmployee> {
  const response = await apiClient.delete<UnassignedCredentialEmployee>(`/employees/${employeeId}/credentials`, {
    params: { type },
  })
  return response.data
}

export async function startFingerprintEnroll(
  deviceId: number,
  employeeId: number,
): Promise<StartEnrollResponse> {
  const response = await apiClient.post<StartEnrollResponse>(
    `/devices/${deviceId}/enroll-fingerprint/${employeeId}`,
    {},
  )
  return response.data
}

export async function getActiveDevices(): Promise<Device[]> {
  const response = await apiClient.get<Device[]>('/devices')
  return response.data
}