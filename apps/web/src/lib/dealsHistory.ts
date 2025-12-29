import type {
  Deal,
  DealEntryLeg,
  DealExitLeg,
  DealProfitOp,
} from '@/types/deals'

export type DealHistoryEventType = 'DCA' | 'PROFIT_REINVEST' | 'PARTIAL_CLOSE'

export type DealHistoryEvent = {
  id: string
  type: DealHistoryEventType
  at: string
  qty?: string
  price?: string
  quote?: string
  fee?: string
  feeAsset?: string
  pnl?: string
  note?: string
  source?: string
}

const toTimestamp = (value?: string) => {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? null : ts
}

const toNumber = (value?: string) => {
  if (value === undefined) return null
  const numeric = Number(value)
  return Number.isNaN(numeric) ? null : numeric
}

const sortByDateAsc = (a: { openedAt?: string }, b: { openedAt?: string }) => {
  const left = toTimestamp(a.openedAt) ?? 0
  const right = toTimestamp(b.openedAt) ?? 0
  return left - right
}

const buildDcaEvents = (entryLegs: DealEntryLeg[] = []) => {
  if (entryLegs.length <= 1) return []
  const sorted = [...entryLegs].sort(sortByDateAsc)
  return sorted.slice(1).map((leg, index) => ({
    id: `DCA:${leg.openedAt}:${leg.orderId ?? index}`,
    type: 'DCA' as const,
    at: leg.openedAt,
    qty: leg.qty,
    price: leg.price,
    quote: leg.quote,
    fee: leg.fee,
    feeAsset: leg.feeAsset,
    note: undefined,
    source: leg.source,
  }))
}

const buildProfitEvents = (profitOps: DealProfitOp[] = []) =>
  profitOps.map((op, index) => ({
    id: `PROFIT_REINVEST:${op.at}:${index}`,
    type: 'PROFIT_REINVEST' as const,
    at: op.at,
    qty: op.qty,
    price: op.price,
    quote: op.amount,
    note: op.note,
  }))

const computeExitPnl = (deal: Deal, leg: DealExitLeg, quoteValue?: string) => {
  const avgPrice = toNumber(deal.entryAvgPrice ?? deal.entry?.price)
  const qty = toNumber(leg.qty)
  const quote = toNumber(quoteValue ?? leg.quote)
  const fee = toNumber(leg.fee) ?? 0
  if (avgPrice === null || qty === null || quote === null) {
    return undefined
  }
  const raw =
    deal.direction === 'SHORT'
      ? qty * avgPrice - quote - fee
      : quote - qty * avgPrice - fee
  return Number.isFinite(raw) ? String(raw) : undefined
}

const buildExitEvents = (deal: Deal, exitLegs: DealExitLeg[] = []) =>
  exitLegs.map((leg, index) => {
    const qty = toNumber(leg.qty)
    const price = toNumber(leg.price)
    const computedQuote =
      qty !== null && price !== null ? String(qty * price) : undefined
    const quoteValue = leg.quote || computedQuote
    return {
      id: `PARTIAL_CLOSE:${leg.closedAt}:${leg.orderId ?? index}`,
      type: 'PARTIAL_CLOSE' as const,
      at: leg.closedAt,
      qty: leg.qty,
      price: leg.price,
      quote: quoteValue,
      fee: leg.fee,
      feeAsset: leg.feeAsset,
      pnl: computeExitPnl(deal, leg, quoteValue),
      source: leg.source,
    }
  })

export const buildDealHistoryEvents = (deal: Deal): DealHistoryEvent[] => {
  const dcaEvents = buildDcaEvents(deal.entryLegs)
  const profitEvents = buildProfitEvents(deal.profitOps)
  const exitEvents = buildExitEvents(deal, deal.exitLegs)

  return [...dcaEvents, ...profitEvents, ...exitEvents].sort((a, b) => {
    const left = toTimestamp(a.at) ?? 0
    const right = toTimestamp(b.at) ?? 0
    return right - left
  })
}
