import { apiFetch } from '@/lib/api'
import { type DealsListResponse, type DealStatus } from '@/types/deals'

export type DealsListFilters = {
  from?: string
  to?: string
  status?: 'ALL' | DealStatus
  symbol?: string
}

type AuthOptions = {
  accessToken: string | null
  onUnauthorized: () => Promise<string | null>
}

function buildQuery(filters: DealsListFilters) {
  const params = new URLSearchParams()

  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.status && filters.status !== 'ALL') {
    params.set('status', filters.status)
  }
  if (filters.symbol) params.set('symbol', filters.symbol)

  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function fetchDeals(filters: DealsListFilters, auth: AuthOptions) {
  return apiFetch<DealsListResponse>(`/deals${buildQuery(filters)}`, {
    method: 'GET',
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}
