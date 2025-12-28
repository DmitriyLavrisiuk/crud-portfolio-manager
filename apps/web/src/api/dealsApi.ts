import { apiFetch } from '@/lib/api'
import {
  type Deal,
  type DealWithOrderResponse,
  type DealsListResponse,
  type DealsStatsResponse,
  type DealStatus,
  type ImportTradesResponse,
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

export type PartialCloseDealPayload = {
  closedAt?: string
  exit: DealExitPayload
  note?: string
}

export type AddEntryLegPayload = {
  openedAt?: string
  entry: DealEntryPayload
  note?: string
}

export type AddEntryLegResponse = {
  deal: Deal
  entryAgg: {
    qtyTotal: string
    quoteTotal: string
    avgPrice: string
  }
  remainingQty: string
}

export type ImportTradesPayload = {
  phase: 'ENTRY' | 'EXIT'
  orderId: number
  symbol?: string
}

export type OpenDealWithOrderPayload = {
  symbol: string
  direction: 'LONG' | 'SHORT'
  marketBuyMode?: 'QUOTE' | 'BASE'
  quoteOrderQty?: string
  quantity?: string
  note?: string
}

export type CloseDealWithOrderPayload = {
  marketBuyMode?: 'QUOTE' | 'BASE'
  quoteOrderQty?: string
  quantity?: string
  note?: string
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

export async function partialCloseDeal(
  id: string,
  payload: PartialCloseDealPayload,
  auth: AuthOptions,
) {
  return apiFetch<Deal>(`/deals/${id}/partial-close`, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function addEntryLeg(
  id: string,
  payload: AddEntryLegPayload,
  auth: AuthOptions,
) {
  return apiFetch<AddEntryLegResponse>(`/deals/${id}/add-entry`, {
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

export async function fetchDealsStats(
  filters: DealsListFilters,
  auth: AuthOptions,
) {
  return apiFetch<DealsStatsResponse>(`/deals/stats${buildQuery(filters)}`, {
    method: 'GET',
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function importDealTrades(
  dealId: string,
  payload: ImportTradesPayload,
  auth: AuthOptions,
) {
  return apiFetch<ImportTradesResponse>(`/deals/${dealId}/import-trades`, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function openDealWithOrder(
  payload: OpenDealWithOrderPayload,
  auth: AuthOptions,
) {
  return apiFetch<DealWithOrderResponse>(`/deals/open-with-order`, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function closeDealWithOrder(
  dealId: string,
  payload: CloseDealWithOrderPayload,
  auth: AuthOptions,
) {
  return apiFetch<DealWithOrderResponse>(`/deals/${dealId}/close-with-order`, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}
