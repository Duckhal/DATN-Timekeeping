export const ROLE_VALUES = ['HR', 'EMPLOYEE'] as const;
export type Role = (typeof ROLE_VALUES)[number];

export type CalcStatus = 'SHORTHOURS' | 'DAYOFF' | 'COMPLETED';

export type RequestType = 'OT' | 'EXPLANATION' | 'LEAVE';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AuthMethod = 'RFID' | 'FINGERPRINT';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
