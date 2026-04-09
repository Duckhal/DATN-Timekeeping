import type { DeviceStatus } from './enums';

export type Device = {
  device_id: number;
  mac_addr: string;
  name: string | null;
  status: DeviceStatus | null;
};
