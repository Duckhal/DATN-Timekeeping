import apiClient from './axios'
import type {
  Device,
  ManagerDevicesPage,
  ManagerDevicesQuery,
  RemoveDeviceResponse,
  UpdateDevicePayload,
} from '../types/device'

export async function getManagerDevices(
  query: ManagerDevicesQuery = {},
): Promise<ManagerDevicesPage> {
  const response = await apiClient.get<ManagerDevicesPage>('/devices/manager', {
    params: {
      search: query.search?.trim() || undefined,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    },
  })
  return response.data
}

export async function updateDevice(deviceId: number, payload: UpdateDevicePayload): Promise<Device> {
  const response = await apiClient.patch<Device>(`/devices/${deviceId}`, payload)
  return response.data
}

export async function removeDevice(deviceId: number): Promise<RemoveDeviceResponse> {
  const response = await apiClient.delete<RemoveDeviceResponse>(`/devices/${deviceId}`)
  return response.data
}

export async function bulkSyncDevice(deviceId: number): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(`/devices/${deviceId}/bulk-sync`)
  return response.data
}
