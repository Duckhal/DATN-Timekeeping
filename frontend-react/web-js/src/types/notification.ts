export type NotificationItem = {
  notification_id: number
  employee_id: number
  title: string
  content: string | null
  type: string
  reference_id: number | null
  metadata: string | null
  is_read: boolean
  created_at: string
}

export type NotificationsPage = {
  items: NotificationItem[]
  page: number
  pageSize: number
  total: number
}

export type NotificationsQuery = {
  page?: number
  pageSize?: number
}
