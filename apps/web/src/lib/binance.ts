import { apiFetch } from '@/lib/api'

export type BinanceCredentialsStatus = {
  connected: boolean
  apiKeyLast4: string | null
  updatedAt?: string
  lastTestedAt?: string
  lastTestOk?: boolean
  lastTestError?: string
}

export type BinanceSpotBalance = {
  asset: string
  free: string
  locked: string
}

export type BinanceSpotAccount = {
  accountType?: string
  permissions?: string[]
  balances: BinanceSpotBalance[]
}

export type BinanceSpotOrder = {
  orderId: number
  clientOrderId?: string
  origClientOrderId?: string
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'MARKET' | 'LIMIT'
  price: string
  origQty: string
  executedQty: string
  status: string
  timeInForce?: string
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

export async function getSpotAccount(auth: AuthOptions) {
  return apiFetch<BinanceSpotAccount>('/binance/spot/account', {
    method: 'GET',
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function getSpotOpenOrders(symbol: string, auth: AuthOptions) {
  const params = new URLSearchParams({ symbol })
  return apiFetch<BinanceSpotOrder[]>(
    `/binance/spot/open-orders?${params.toString()}`,
    {
      method: 'GET',
      accessToken: auth.accessToken,
      onUnauthorized: auth.onUnauthorized,
    },
  )
}

export async function placeSpotOrder(
  payload: {
    symbol: string
    side: 'BUY' | 'SELL'
    type: 'MARKET' | 'LIMIT'
    quantity?: string
    quoteOrderQty?: string
    price?: string
    timeInForce?: 'GTC'
  },
  auth: AuthOptions,
) {
  return apiFetch<BinanceSpotOrder>('/binance/spot/order', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function cancelSpotOrder(
  payload: {
    symbol: string
    orderId?: number | string
    origClientOrderId?: string
  },
  auth: AuthOptions,
) {
  return apiFetch<{ ok: true }>('/binance/spot/order', {
    method: 'DELETE',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function querySpotOrder(
  payload: {
    symbol: string
    orderId?: number | string
    origClientOrderId?: string
  },
  auth: AuthOptions,
) {
  const params = new URLSearchParams(
    Object.entries(payload).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value === undefined) return acc
        acc[key] = String(value)
        return acc
      },
      {},
    ),
  )

  return apiFetch<BinanceSpotOrder>(
    `/binance/spot/order?${params.toString()}`,
    {
      method: 'GET',
      accessToken: auth.accessToken,
      onUnauthorized: auth.onUnauthorized,
    },
  )
}
