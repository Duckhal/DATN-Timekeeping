export type RequestType = 'OT' | 'EXPLANATION' | 'LEAVE'
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type RequestItem = {
  request_id: number
  employee_id: number
  attendance_id: string | null
  type: RequestType
  status: RequestStatus
  date: string
  start_time: string | null
  end_time: string | null
  reason: string | null
  created_at: string
  updated_at: string
  employee?: { full_name: string; email: string }
}

export type RequestsPage = {
  items: RequestItem[]
  page: number
  pageSize: number
  total: number
}

export type CreateOtRequestPayload = {
  reason: string
  date?: string
}

export type CreateExplanationPayload = {
  attendance_id: number
  reason: string
  end_time?: string
}

export type RequestsQuery = {
  type?: RequestType
  status?: RequestStatus
  page?: number
  pageSize?: number
}

export type ManagerRequestsQuery = RequestsQuery & {
  search?: string
}

export type MissingCheckoutDay = {
  attendance_id: string
  date: string
  checkin_time: string | null
}
