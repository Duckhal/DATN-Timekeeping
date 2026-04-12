export const DEVICE_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const
export type DeviceStatus = (typeof DEVICE_STATUS_VALUES)[number]

export type Device = {
  device_id: number
  mac_addr: string
  name: string
  status: DeviceStatus
  created_at: string
  updated_at: string
}

export type UpdateDevicePayload = {
  name?: string
  status?: DeviceStatus
}

export type RemoveDeviceResponse = {
  mode: 'SOFT_DELETE' | 'HARD_DELETE'
  message: string
  device: Device
}
