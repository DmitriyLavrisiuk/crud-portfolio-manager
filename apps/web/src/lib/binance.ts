import { apiFetch } from '@/lib/api'

export type BinanceCredentialsStatus = {
  connected: boolean
  apiKeyLast4: string | null
  updatedAt?: string
  lastTestedAt?: string
  lastTestOk?: boolean
  lastTestError?: string
}

type AuthOptions = {
  accessToken: string | null
  onUnauthorized: () => Promise<string | null>
}

export async function getBinanceCredentials(auth: AuthOptions) {
  return apiFetch<BinanceCredentialsStatus>('/binance/credentials', {
    method: 'GET',
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function saveBinanceCredentials(
  payload: { apiKey: string; apiSecret: string },
  auth: AuthOptions,
) {
  return apiFetch<{ ok: true }>('/binance/credentials', {
    method: 'PUT',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function deleteBinanceCredentials(auth: AuthOptions) {
  return apiFetch<{ ok: true }>('/binance/credentials', {
    method: 'DELETE',
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function testBinanceCredentials(auth: AuthOptions) {
  return apiFetch<{ ok: boolean; message?: string }>(
    '/binance/credentials/test',
    {
      method: 'POST',
      accessToken: auth.accessToken,
      onUnauthorized: auth.onUnauthorized,
    },
  )
}
