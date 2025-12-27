export type DealDirection = 'LONG' | 'SHORT'
export type DealStatus = 'OPEN' | 'CLOSED'

export type DealLeg = {
  qty: string
  price: string
  quote: string
  fee?: string
  feeAsset?: string
}

export type DealExitLeg = DealLeg & {
  closedAt: string
  source?: 'MANUAL' | 'BINANCE'
  orderId?: number
}

export type TradeFill = {
  id: number
  orderId: number
  price: string
  qty: string
  quoteQty: string
  commission: string
  commissionAsset: string
  time: number
  isBuyer: boolean
  isMaker: boolean
}

export type ImportTradesResponse = {
  dealId: string
  phase: 'ENTRY' | 'EXIT'
  importedCount: number
  totalTradesInPhase: number
  aggregate: {
    qty: string
    price: string
    quote: string
    fee?: string
    feeAsset?: string
  }
  preview: TradeFill[]
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
  exitLegs?: DealExitLeg[]
  closedQty?: string
  remainingQty?: string
  realizedPnl?: string
  note?: string
  createdAt?: string
  updatedAt?: string
}

export type BinanceOrderInfo = {
  orderId: number
  side: 'BUY' | 'SELL'
  type: 'MARKET'
}

export type DealWithOrderResponse = {
  deal: Deal
  binance: BinanceOrderInfo
  importedCount: number
  aggregate: {
    qty: string
    price: string
    quote: string
    fee?: string
    feeAsset?: string
  }
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
