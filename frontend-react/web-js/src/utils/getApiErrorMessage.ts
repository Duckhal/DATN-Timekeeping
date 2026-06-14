type ApiErrorPayload = {
  message?: unknown
}

type ApiErrorShape = {
  response?: {
    data?: ApiErrorPayload
  }
}

function hasApiErrorShape(error: unknown): error is ApiErrorShape {
  return typeof error === 'object' && error !== null && 'response' in error
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!hasApiErrorShape(error)) {
    return fallback
  }

  const message = error.response?.data?.message
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : fallback
}
