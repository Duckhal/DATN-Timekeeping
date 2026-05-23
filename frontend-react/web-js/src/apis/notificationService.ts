import apiClient from './axios'
import type { NotificationsPage, NotificationsQuery } from '../types/notification'

export async function getNotifications(query: NotificationsQuery = {}): Promise<NotificationsPage> {
  const params: Record<string, number> = {}
  if (query.page) params.page = query.page
  if (query.pageSize) params.pageSize = query.pageSize
  const response = await apiClient.get<NotificationsPage>('/notifications', { params })
  return response.data
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const response = await apiClient.get<{ count: number }>('/notifications/unread-count')
  return response.data
}

export async function markAsRead(id: number): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`)
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all')
}
