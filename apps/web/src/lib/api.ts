const API_URL = import.meta.env.VITE_API_URL

type ApiFetchOptions = RequestInit & {
  accessToken?: string | null
  onUnauthorized?: () => Promise<string | null>
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { accessToken, onUnauthorized, ...init } = options
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    }
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
          Authorization: `Bearer ${newAccessToken}`
        }
      })
      return await parseJson<T>(retry)
    }
  }

  return await parseJson<T>(response)
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await safeErrorMessage(response)
    throw new Error(message)
  }
  return (await response.json()) as T
}

async function safeErrorMessage(response: Response) {
  try {
    const data = await response.json()
    return data?.message ?? `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}
