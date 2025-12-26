import { apiFetch } from '@/lib/api'
import {
  type Deal,
  type DealsListResponse,
  type DealStatus,
} from '@/types/deals'

export type DealEntryPayload = {
  qty: string
  price: string
  fee?: string
  feeAsset?: string
}

export type DealExitPayload = {
  qty: string
  price: string
  fee?: string
  feeAsset?: string
}

export type CreateDealPayload = {
  symbol: string
  direction: 'LONG' | 'SHORT'
  openedAt: string
  note?: string
  entry: DealEntryPayload
}

export type UpdateDealPayload = CreateDealPayload

export type CloseDealPayload = {
  closedAt: string
  exit: DealExitPayload
}

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

export async function createDeal(
  payload: CreateDealPayload,
  auth: AuthOptions,
) {
  return apiFetch<Deal>(`/deals`, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function updateDeal(
  id: string,
  payload: UpdateDealPayload,
  auth: AuthOptions,
) {
  return apiFetch<Deal>(`/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function closeDeal(
  id: string,
  payload: CloseDealPayload,
  auth: AuthOptions,
) {
  return apiFetch<Deal>(`/deals/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function deleteDeal(id: string, auth: AuthOptions) {
  return apiFetch<{ ok: true }>(`/deals/${id}`, {
    method: 'DELETE',
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}
