export type DealDirection = 'LONG' | 'SHORT'
export type DealStatus = 'OPEN' | 'CLOSED'

export type DealLeg = {
  qty: string
  price: string
  quote: string
  fee?: string
  feeAsset?: string
}

export type Deal = {
  id: string
  _id?: string
  symbol: string
  direction: DealDirection
  status: DealStatus
  openedAt: string
  closedAt?: string
  entry: DealLeg
  exit?: DealLeg
  realizedPnl?: string
  note?: string
  createdAt?: string
  updatedAt?: string
}

export type DealsListResponse = {
  items: Deal[]
  page: number
  limit: number
  total: number
}

export type DealsStatsResponse = {
  totalPnL: string
  tradesCount: number
  winRate: number
  avgPnL: string
  feesTotal: string
  openCount: number
}
