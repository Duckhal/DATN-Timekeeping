import type { Employee } from './auth'

export type UnassignedCredentialEmployee = Employee

export type AssignRfidPayload = {
  rfid_tag: string
}

export type CredentialType = 'RFID' | 'FINGERPRINT'

export type StartEnrollResponse = {
  message: string
}
