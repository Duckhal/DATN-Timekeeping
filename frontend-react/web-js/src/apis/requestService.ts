import apiClient from './axios'
import type {
  RequestItem,
  ManagerRequestsQuery,
  RequestsPage,
  RequestsQuery,
  CreateOtRequestPayload,
  CreateExplanationPayload,
  MissingCheckoutDay,
} from '../types/request'

export async function getMyRequests(query: RequestsQuery = {}): Promise<RequestsPage> {
  const params: Record<string, string | number> = {}
  if (query.type) params.type = query.type
  if (query.status) params.status = query.status
  if (query.page) params.page = query.page
  if (query.pageSize) params.pageSize = query.pageSize
  const response = await apiClient.get<RequestsPage>('/requests/me', { params })
  return response.data
}

export async function getManagerRequests(query: ManagerRequestsQuery = {}): Promise<RequestsPage> {
  const params: Record<string, string | number> = {}
  if (query.type) params.type = query.type
  if (query.status) params.status = query.status
  if (query.search?.trim()) params.search = query.search.trim()
  if (query.page) params.page = query.page
  if (query.pageSize) params.pageSize = query.pageSize
  const response = await apiClient.get<RequestsPage>('/requests/manager', { params })
  return response.data
}

export async function createOtRequest(payload: CreateOtRequestPayload): Promise<RequestItem> {
  const response = await apiClient.post<RequestItem>('/requests/ot', payload)
  return response.data
}

export async function createExplanationRequest(payload: CreateExplanationPayload): Promise<RequestItem> {
  const response = await apiClient.post<RequestItem>('/requests/explanation', payload)
  return response.data
}

export async function approveRequest(id: number): Promise<RequestItem> {
  const response = await apiClient.patch<RequestItem>(`/requests/${id}/approve`)
  return response.data
}

export async function rejectRequest(id: number): Promise<RequestItem> {
  const response = await apiClient.patch<RequestItem>(`/requests/${id}/reject`)
  return response.data
}

export async function getMissingCheckoutDays(): Promise<MissingCheckoutDay[]> {
  const response = await apiClient.get<MissingCheckoutDay[]>('/attendance/me/missing-checkout')
  return response.data
}
