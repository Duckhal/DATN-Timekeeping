export const DEVICE_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const
export type DeviceStatus = (typeof DEVICE_STATUS_VALUES)[number]

export type Device = {
  device_id: number
  mac_addr: string
  name: string | null
  status: DeviceStatus
}

export type ManagerDevicesQuery = {
  search?: string
  status?: DeviceStatus
  page?: number
  pageSize?: number
}

export type ManagerDevicesPage = {
  items: Device[]
  page: number
  pageSize: number
  total: number
}

export type UpdateDevicePayload = {
  name?: string
  status?: DeviceStatus
}

export type RemoveDeviceResponse = {
  mode: 'SOFT_DELETE'
  message: string
  device: Device
}
