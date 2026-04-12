import apiClient from './axios'
import type {
  AssignRfidPayload,
  ConfirmFingerprintPayload,
  CredentialType,
  StartEnrollResponse,
  UnassignedCredentialEmployee,
} from '../types/credentials'
import type { Device } from '../types/device'

export async function getUnassignedCredentialEmployees(): Promise<UnassignedCredentialEmployee[]> {
  const response = await apiClient.get<UnassignedCredentialEmployee[]>('/employees/unassigned-credentials')
  return response.data
}

export async function attachRfidCard(employeeId: number, payload: AssignRfidPayload): Promise<UnassignedCredentialEmployee> {
  const response = await apiClient.patch<UnassignedCredentialEmployee>(`/employees/${employeeId}/credentials/rfid`, payload)
  return response.data
}

export async function removeCredential(employeeId: number, type: CredentialType): Promise<UnassignedCredentialEmployee> {
  const response = await apiClient.delete<UnassignedCredentialEmployee>(`/employees/${employeeId}/credentials`, {
    params: { type },
  })
  return response.data
}

export async function startFingerprintEnroll(deviceId: number): Promise<StartEnrollResponse> {
  const response = await apiClient.post<StartEnrollResponse>(`/devices/${deviceId}/enroll-fingerprint`, {})
  return response.data
}

export async function confirmFingerprint(employeeId: number, payload: ConfirmFingerprintPayload): Promise<UnassignedCredentialEmployee> {
  const response = await apiClient.patch<UnassignedCredentialEmployee>(`/employees/${employeeId}/credentials/fingerprint`, payload)
  return response.data
}

export async function getActiveDevices(): Promise<Device[]> {
  const response = await apiClient.get<Device[]>('/devices')
  return response.data
}
