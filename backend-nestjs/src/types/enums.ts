export const ROLE_VALUES = ['MANAGER', 'EMPLOYEE'] as const;
export type Role = (typeof ROLE_VALUES)[number];

export const CALC_STATUS_VALUES = ['SHORTHOURS', 'DAYOFF', 'COMPLETED', 'WEEKEND'] as const;
export type CalcStatus = (typeof CALC_STATUS_VALUES)[number];

export const REQUEST_TYPE_VALUES = ['OT', 'EXPLANATION', 'LEAVE'] as const;
export type RequestType = 'OT' | 'EXPLANATION' | 'LEAVE';

export const REQUEST_STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const AUTH_METHOD_VALUES = ['RFID', 'FINGERPRINT'] as const;
export type AuthMethod = 'RFID' | 'FINGERPRINT';

export const DEVICE_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const;
export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
