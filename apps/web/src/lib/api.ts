const API_URL = import.meta.env.VITE_API_URL

type ApiFetchOptions = RequestInit & {
  accessToken?: string | null
  onUnauthorized?: () => Promise<string | null>
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { accessToken, onUnauthorized, ...init } = options
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (response.status === 401 && onUnauthorized) {
    const newAccessToken = await onUnauthorized()
    if (newAccessToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
          Authorization: `Bearer ${newAccessToken}`,
        },
      })
      return await parseJson<T>(retry)
    }
  }

  return await parseJson<T>(response)
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await safeJson(response)
  if (!response.ok) {
    const message = data?.message ?? `Request failed (${response.status})`
    const error = new Error(message) as Error & { data?: unknown }
    if (data) {
      error.data = data
    }
    throw error
  }
  return data as T
}

async function safeJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
