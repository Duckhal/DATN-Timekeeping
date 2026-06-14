import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import { getNotifications, getUnreadCount, markAllAsRead, markAsRead } from '../apis/notificationService'
import type { NotificationItem } from '../types/notification'
import { AUTH_TOKEN_KEY } from '../apis/axios'
import { NotificationContext } from './NotificationContextValue'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await getUnreadCount()
      setUnreadCount(count)
    } catch { /* silent */ }
  }, [])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getNotifications({ pageSize: 20 })
      setNotifications(data.items)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const handleMarkAsRead = useCallback(async (id: number) => {
    await markAsRead(id)
    setNotifications((prev) => prev.map((n) => n.notification_id === id ? { ...n, is_read: true } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
  }, [])

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    if (isBootstrapping || !isAuthenticated) return

    void fetchUnreadCount()
    void fetchNotifications()

    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) return

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const serverUrl = baseUrl.replace(/\/api$/, '')

    const socket = io(serverUrl, {
      query: { token },
      transports: ['websocket'],
    })

    socket.on('notification:new', (payload: NotificationItem) => {
      setNotifications((prev) => [payload, ...prev])
      setUnreadCount((c) => c + 1)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, isBootstrapping, fetchUnreadCount, fetchNotifications])

  return (
    <NotificationContext.Provider
      value={{ unreadCount, notifications, loading, fetchNotifications, handleMarkAsRead, handleMarkAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
