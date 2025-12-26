import { apiFetch } from '@/lib/api'

export type TransactionType = 'BUY' | 'SELL'

export type Transaction = {
  id: string
  userId?: string
  type: TransactionType
  symbol: string
  quantity: number
  price?: number
  fee?: number
  feeAsset?: string
  occurredAt: string
  exchange?: string
  note?: string
  createdAt?: string
  updatedAt?: string
}

export type ListTransactionsFilters = {
  from?: string
  to?: string
  symbol?: string
  type?: TransactionType
  page?: number
  limit?: number
}

export type ListTransactionsResponse = {
  items: Transaction[]
  page: number
  limit: number
  total: number
}

type AuthOptions = {
  accessToken: string | null
  onUnauthorized: () => Promise<string | null>
}

function buildQuery(filters: ListTransactionsFilters) {
  const params = new URLSearchParams()

  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.symbol) params.set('symbol', filters.symbol)
  if (filters.type) params.set('type', filters.type)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))

  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function listTransactions(
  filters: ListTransactionsFilters,
  auth: AuthOptions,
) {
  return apiFetch<ListTransactionsResponse>(
    `/transactions${buildQuery(filters)}`,
    {
      method: 'GET',
      accessToken: auth.accessToken,
      onUnauthorized: auth.onUnauthorized,
    },
  )
}

export async function createTransaction(
  payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  auth: AuthOptions,
) {
  return apiFetch<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function updateTransaction(
  id: string,
  payload: Partial<
    Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
  >,
  auth: AuthOptions,
) {
  return apiFetch<Transaction>(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}

export async function deleteTransaction(id: string, auth: AuthOptions) {
  return apiFetch<{ ok: true }>(`/transactions/${id}`, {
    method: 'DELETE',
    accessToken: auth.accessToken,
    onUnauthorized: auth.onUnauthorized,
  })
}
