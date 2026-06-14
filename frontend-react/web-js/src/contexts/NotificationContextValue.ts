import { createContext } from 'react'
import type { NotificationItem } from '../types/notification'

export type NotificationContextType = {
  unreadCount: number
  notifications: NotificationItem[]
  loading: boolean
  fetchNotifications: () => Promise<void>
  handleMarkAsRead: (id: number) => Promise<void>
  handleMarkAllAsRead: () => Promise<void>
}

export const NotificationContext =
  createContext<NotificationContextType | null>(null)
