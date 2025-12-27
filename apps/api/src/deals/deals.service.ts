import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import Big from 'big.js'
import { Model, type FilterQuery } from 'mongoose'

import {
  BinanceFilterException,
  BinanceSpotClientService,
} from '../binance/binance-spot-client.service'
import {
  type CloseDealDto,
  type CloseDealWithOrderDto,
  type CreateDealDto,
  type DealsStatsQuery,
  type OpenDealWithOrderDto,
  type ListDealsQuery,
  type UpdateDealDto,
  type ImportTradesDto,
} from './dto/deals.schemas'
import {
  Deal,
  type DealDirection,
  type DealDocument,
  type DealLeg,
  type TradeFill,
} from './schemas/deal.schema'

type TradesAggregate = {
  qty: string
  quote: string
  price: string
  feeInQuote?: string
  quoteAsset?: string
  feeByAsset: Record<string, string>
}

@Injectable()
export class DealsService {
  constructor(
    @InjectModel(Deal.name)
    private dealModel: Model<DealDocument>,
    private binanceSpotClient: BinanceSpotClientService,
  ) {}

  async createDeal(userId: string, data: CreateDealDto) {
    const entry = {
      ...data.entry,
      quote: this.computeQuote(data.entry.qty, data.entry.price),
    }

    const created = new this.dealModel({
      userId,
      symbol: data.symbol,
      direction: data.direction,
      status: 'OPEN',
      openedAt: data.openedAt,
      note: data.note,
      entry,
    })

    return created.save()
  }

  async listDeals(userId: string, query: ListDealsQuery) {
    const filter: FilterQuery<DealDocument> = { userId }

    if (query.status && query.status !== 'ALL') {
      filter.status = query.status
    }

    if (query.symbol) {
      filter.symbol = query.symbol
    }

    if (query.from || query.to) {
      filter.openedAt = {}
      if (query.from) {
        filter.openedAt.$gte = query.from
      }
      if (query.to) {
        filter.openedAt.$lte = query.to
      }
    }

    const page = query.page && query.page > 0 ? query.page : 1
    const limit = Math.min(query.limit ?? 50, 100)
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      this.dealModel
        .find(filter)
        .sort({ openedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      this.dealModel.countDocuments(filter),
    ])

    return { items, total, page, limit }
  }

  async getDealsStats(userId: string, query: DealsStatsQuery) {
    const filter: FilterQuery<DealDocument> = { userId }

    if (query.symbol) {
      filter.symbol = query.symbol
    }

    if (query.from || query.to) {
      filter.openedAt = {}
      if (query.from) {
        filter.openedAt.$gte = query.from
      }
      if (query.to) {
        filter.openedAt.$lte = query.to
      }
    }

    const status = query.status ?? 'ALL'

    const openCount =
      status === 'CLOSED'
        ? 0
        : await this.dealModel.countDocuments({ ...filter, status: 'OPEN' })

    if (status === 'OPEN') {
      return {
        totalPnL: '0',
        tradesCount: 0,
        winRate: 0,
        avgPnL: '0',
        feesTotal: '0',
        openCount,
      }
    }

    const closedDeals = await this.dealModel
      .find(
        { ...filter, status: 'CLOSED' },
        { realizedPnl: 1, 'entry.fee': 1, 'exit.fee': 1 },
      )
      .lean()

    let totalPnL = new Big(0)
    let feesTotal = new Big(0)
    let winCount = 0

    for (const deal of closedDeals) {
      const realized = this.toBig(String(deal.realizedPnl ?? '0'))
      totalPnL = totalPnL.plus(realized)
      if (realized.gt(0)) {
        winCount += 1
      }

      const entryFee = this.toBig(String(deal.entry?.fee ?? '0'))
      const exitFee = this.toBig(String(deal.exit?.fee ?? '0'))
      feesTotal = feesTotal.plus(entryFee).plus(exitFee)
    }

    const tradesCount = closedDeals.length
    const avgPnL = tradesCount > 0 ? totalPnL.div(tradesCount).toString() : '0'
    const winRate =
      tradesCount > 0
        ? Number(new Big(winCount).div(tradesCount).times(100).toFixed(2))
        : 0

    return {
      totalPnL: totalPnL.toString(),
      tradesCount,
      winRate,
      avgPnL,
      feesTotal: feesTotal.toString(),
      openCount,
    }
  }

  async findByIdForUser(userId: string, id: string) {
    return this.dealModel.findOne({ _id: id, userId })
  }

  async updateByIdForUser(userId: string, id: string, update: UpdateDealDto) {
    const deal = await this.dealModel.findOne({ _id: id, userId })
    if (!deal) {
      return null
    }

    let needsRecalc = false

    if (update.symbol) {
      deal.symbol = update.symbol
    }
    if (update.direction) {
      deal.direction = update.direction
      needsRecalc = deal.status === 'CLOSED'
    }
    if (update.openedAt) {
      deal.openedAt = update.openedAt
    }
    if (Object.prototype.hasOwnProperty.call(update, 'note')) {
      deal.note = update.note
    }

    if (update.entry) {
      const entry = deal.entry
      const nextQty = update.entry.qty ?? entry.qty
      const nextPrice = update.entry.price ?? entry.price

      if (update.entry.qty) {
        entry.qty = update.entry.qty
      }
      if (update.entry.price) {
        entry.price = update.entry.price
      }
      if (Object.prototype.hasOwnProperty.call(update.entry, 'fee')) {
        entry.fee = update.entry.fee
      }
      if (Object.prototype.hasOwnProperty.call(update.entry, 'feeAsset')) {
        entry.feeAsset = update.entry.feeAsset
      }

      entry.quote = this.computeQuote(nextQty, nextPrice)
      needsRecalc = deal.status === 'CLOSED'
    }

    if (deal.status === 'CLOSED' && needsRecalc) {
      if (!deal.exit) {
        throw new BadRequestException('Exit leg is required for closed deals')
      }
      deal.realizedPnl = this.computePnl(
        deal.direction,
        deal.entry.quote,
        deal.exit.quote,
        deal.entry.fee,
        deal.exit.fee,
      )
    }

    return deal.save()
  }

  async closeDealForUser(userId: string, id: string, data: CloseDealDto) {
    const deal = await this.dealModel.findOne({ _id: id, userId })
    if (!deal) {
      return null
    }

    if (deal.status === 'CLOSED') {
      throw new BadRequestException('Deal is already closed')
    }

    const entryQuote =
      deal.entry.quote ?? this.computeQuote(deal.entry.qty, deal.entry.price)
    deal.entry.quote = entryQuote

    const exitQuote = this.computeQuote(data.exit.qty, data.exit.price)
    deal.exit = { ...data.exit, quote: exitQuote }
    deal.closedAt = data.closedAt
    deal.status = 'CLOSED'
    deal.realizedPnl = this.computePnl(
      deal.direction,
      entryQuote,
      exitQuote,
      deal.entry.fee,
      data.exit.fee,
    )

    return deal.save()
  }

  async importTradesForUser(
    userId: string,
    id: string,
    payload: ImportTradesDto,
  ) {
    const deal = await this.dealModel.findOne({ _id: id, userId })
    if (!deal) {
      return null
    }

    const symbol = (payload.symbol || deal.symbol).trim().toUpperCase()
    if (!symbol) {
      throw new BadRequestException('Symbol is required')
    }

    if (payload.startTime && payload.endTime) {
      const maxWindow = 24 * 60 * 60 * 1000
      if (payload.endTime - payload.startTime > maxWindow) {
        throw new BadRequestException('Time window must be within 24 hours')
      }
    }

    let trades: TradeFill[]
    try {
      trades = await this.binanceSpotClient.getMyTrades(userId, {
        symbol,
        orderId: payload.orderId,
        startTime: payload.startTime,
        endTime: payload.endTime,
        limit: payload.limit,
      })
    } catch (error) {
      throw this.mapBinanceError(error)
    }

    const result = this.applyTradesToDeal(deal, payload.phase, trades)
    await deal.save()

    return {
      dealId: String(deal._id),
      phase: payload.phase,
      importedCount: result.importedCount,
      totalTradesInPhase: result.totalTrades,
      aggregate: {
        qty: result.leg.qty,
        price: result.leg.price,
        quote: result.leg.quote,
        fee: result.leg.fee,
        feeAsset: result.leg.feeAsset,
      },
      preview: result.preview,
    }
  }

  async openDealWithOrder(userId: string, payload: OpenDealWithOrderDto) {
    const symbol = payload.symbol.trim().toUpperCase()
    const side = payload.direction === 'LONG' ? 'BUY' : 'SELL'
    const orderPayload = this.buildMarketOrderPayload(
      side,
      payload.marketBuyMode,
      payload.quantity,
      payload.quoteOrderQty,
    )

    const order = await this.placeMarketOrder(
      userId,
      symbol,
      side,
      orderPayload,
    )
    const trades = await this.fetchTradesByOrderId(
      userId,
      symbol,
      order.orderId,
    )

    if (trades.length === 0) {
      throw new ConflictException('Order has no fills yet')
    }

    const deal = new this.dealModel({
      userId,
      symbol,
      direction: payload.direction,
      status: 'OPEN',
      openedAt: new Date(),
      note: payload.note,
      entry: {
        qty: '0',
        price: '0',
        quote: '0',
      },
    })

    const applied = this.applyTradesToDeal(deal, 'ENTRY', trades)
    await deal.save()

    return {
      deal: this.mapDeal(deal),
      binance: { orderId: order.orderId, side, type: 'MARKET' as const },
      importedCount: applied.importedCount,
      aggregate: {
        qty: applied.leg.qty,
        price: applied.leg.price,
        quote: applied.leg.quote,
        fee: applied.leg.fee,
        feeAsset: applied.leg.feeAsset,
      },
    }
  }

  async closeDealWithOrder(
    userId: string,
    id: string,
    payload: CloseDealWithOrderDto,
  ) {
    const deal = await this.dealModel.findOne({ _id: id, userId })
    if (!deal) {
      return null
    }

    if (deal.status === 'CLOSED') {
      throw new BadRequestException('Deal is already closed')
    }

    const symbol = deal.symbol.trim().toUpperCase()
    const side = deal.direction === 'LONG' ? 'SELL' : 'BUY'
    const orderPayload = this.buildMarketOrderPayload(
      side,
      payload.marketBuyMode,
      payload.quantity ?? deal.entry?.qty,
      payload.quoteOrderQty,
    )

    const order = await this.placeMarketOrder(
      userId,
      symbol,
      side,
      orderPayload,
    )
    const trades = await this.fetchTradesByOrderId(
      userId,
      symbol,
      order.orderId,
    )

    if (trades.length === 0) {
      throw new ConflictException('Order has no fills yet')
    }

    const applied = this.applyTradesToDeal(deal, 'EXIT', trades)
    deal.status = 'CLOSED'
    deal.closedAt = new Date()
    if (payload.note) {
      this.appendNote(deal, payload.note)
    }
    if (deal.exit) {
      deal.realizedPnl = this.computePnl(
        deal.direction,
        deal.entry.quote,
        deal.exit.quote,
        deal.entry.fee,
        deal.exit.fee,
      )
    }

    await deal.save()

    return {
      deal: this.mapDeal(deal),
      binance: { orderId: order.orderId, side, type: 'MARKET' as const },
      importedCount: applied.importedCount,
      aggregate: {
        qty: applied.leg.qty,
        price: applied.leg.price,
        quote: applied.leg.quote,
        fee: applied.leg.fee,
        feeAsset: applied.leg.feeAsset,
      },
    }
  }

  async deleteByIdForUser(userId: string, id: string) {
    return this.dealModel.findOneAndDelete({ _id: id, userId })
  }

  private computeQuote(qty: string, price: string) {
    return this.toBig(qty).times(this.toBig(price)).toString()
  }

  private buildMarketOrderPayload(
    side: 'BUY' | 'SELL',
    marketBuyMode: 'QUOTE' | 'BASE' | undefined,
    quantity: string | undefined,
    quoteOrderQty: string | undefined,
  ) {
    if (side === 'BUY') {
      if (marketBuyMode === 'QUOTE') {
        if (!quoteOrderQty) {
          throw new BadRequestException('quoteOrderQty is required')
        }
        return { quoteOrderQty }
      }
      if (!quantity) {
        throw new BadRequestException('quantity is required')
      }
      return { quantity }
    }

    if (!quantity) {
      throw new BadRequestException('quantity is required')
    }
    return { quantity }
  }

  private async placeMarketOrder(
    userId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    payload: { quantity?: string; quoteOrderQty?: string },
  ) {
    try {
      const response = await this.binanceSpotClient.placeOrder(userId, {
        symbol,
        side,
        type: 'MARKET',
        quantity: payload.quantity,
        quoteOrderQty: payload.quoteOrderQty,
      })
      const orderId = Number(
        (response as { orderId?: number | string }).orderId,
      )
      if (!Number.isFinite(orderId)) {
        throw new BadRequestException('Binance orderId missing in response')
      }
      return { orderId }
    } catch (error) {
      throw this.mapBinanceError(error)
    }
  }

  private async fetchTradesByOrderId(
    userId: string,
    symbol: string,
    orderId: number,
  ) {
    try {
      return await this.binanceSpotClient.getMyTrades(userId, {
        symbol,
        orderId,
        limit: 100,
      })
    } catch (error) {
      throw this.mapBinanceError(error)
    }
  }

  private applyTradesToDeal(
    deal: DealDocument,
    phase: 'ENTRY' | 'EXIT',
    trades: TradeFill[],
  ) {
    const existing =
      phase === 'ENTRY' ? (deal.entryTrades ?? []) : (deal.exitTrades ?? [])
    const { merged, importedCount } = this.mergeTrades(existing, trades)
    const aggregate = this.aggregateTrades(merged)

    if (phase === 'ENTRY') {
      this.applyAggregateToLeg(deal.entry, aggregate, deal)
      deal.entryTrades = merged
    } else {
      if (!deal.exit) {
        deal.exit = {
          qty: aggregate.qty,
          price: aggregate.price,
          quote: aggregate.quote,
        }
      }
      this.applyAggregateToLeg(deal.exit, aggregate, deal)
      deal.exitTrades = merged
    }

    if (deal.status === 'CLOSED' && deal.exit) {
      deal.realizedPnl = this.computePnl(
        deal.direction,
        deal.entry.quote,
        deal.exit.quote,
        deal.entry.fee,
        deal.exit.fee,
      )
    }

    const leg = phase === 'ENTRY' ? deal.entry : deal.exit
    return {
      importedCount,
      totalTrades: merged.length,
      leg,
      preview: merged.slice(0, 20),
    }
  }

  private mergeTrades(existing: TradeFill[], incoming: TradeFill[]) {
    const merged = [...existing]
    const seen = new Set(existing.map((trade) => trade.id))
    let importedCount = 0

    for (const trade of incoming) {
      if (seen.has(trade.id)) {
        continue
      }
      merged.push(trade)
      seen.add(trade.id)
      importedCount += 1
    }

    merged.sort((left, right) => {
      if (left.time !== right.time) {
        return left.time - right.time
      }
      return left.id - right.id
    })

    return { merged, importedCount }
  }

  private aggregateTrades(trades: TradeFill[]): TradesAggregate {
    let sumQty = this.toBig('0')
    let sumQuote = this.toBig('0')
    const feeByAsset = new Map<string, Big>()

    for (const trade of trades) {
      sumQty = sumQty.plus(this.toBig(trade.qty))
      sumQuote = sumQuote.plus(this.toBig(trade.quoteQty))

      const current = feeByAsset.get(trade.commissionAsset) ?? this.toBig('0')
      feeByAsset.set(
        trade.commissionAsset,
        current.plus(this.toBig(trade.commission)),
      )
    }

    const price = sumQty.gt(0) ? sumQuote.div(sumQty) : this.toBig('0')
    const feeByAssetRecord: Record<string, string> = {}
    for (const [asset, total] of feeByAsset.entries()) {
      feeByAssetRecord[asset] = total.toString()
    }

    let feeInQuote: string | undefined
    let quoteAsset: string | undefined
    if (feeByAsset.size === 1) {
      const [asset, total] = Array.from(feeByAsset.entries())[0]
      feeInQuote = total.toString()
      quoteAsset = asset
    }

    return {
      qty: sumQty.toString(),
      quote: sumQuote.toString(),
      price: price.toString(),
      feeInQuote,
      quoteAsset,
      feeByAsset: feeByAssetRecord,
    }
  }

  private applyAggregateToLeg(
    leg: DealLeg,
    aggregate: TradesAggregate,
    deal: DealDocument,
  ) {
    leg.qty = aggregate.qty
    leg.price = aggregate.price
    leg.quote = aggregate.quote

    const feeAssets = Object.keys(aggregate.feeByAsset)
    if (feeAssets.length === 1) {
      const asset = feeAssets[0]
      leg.fee = aggregate.feeByAsset[asset]
      leg.feeAsset = asset
      return
    }

    if (feeAssets.length > 1) {
      this.appendNoteOnce(deal, 'Fee assets are mixed.')
    }
  }

  private appendNoteOnce(deal: DealDocument, message: string) {
    const current = deal.note?.trim()
    if (current?.includes(message)) {
      return
    }
    const next = current ? `${current} ${message}` : message
    deal.note = next.length > 500 ? next.slice(0, 500) : next
  }

  private appendNote(deal: DealDocument, message: string) {
    const trimmed = message.trim()
    if (!trimmed) return
    const current = deal.note?.trim()
    const next = current ? `${current} ${trimmed}` : trimmed
    deal.note = next.length > 500 ? next.slice(0, 500) : next
  }

  private mapBinanceError(error: unknown) {
    if (error instanceof BinanceFilterException) {
      return new BadRequestException(error.message)
    }
    if (error instanceof Error) {
      const message = error.message
      if (message.toLowerCase().includes('insufficient')) {
        return new BadRequestException(message)
      }
      return new BadRequestException(message)
    }
    return new BadRequestException('Binance request failed')
  }

  private mapDeal(deal: DealDocument) {
    const obj =
      typeof (deal as { toObject?: () => Deal }).toObject === 'function'
        ? (deal as { toObject: () => Deal }).toObject()
        : (deal as Deal)
    const { _id, __v, userId, ...rest } = obj as Deal & {
      _id: unknown
      __v?: unknown
      userId?: unknown
    }
    void __v
    void userId
    return { ...rest, id: String(_id) }
  }

  private computePnl(
    direction: DealDirection,
    entryQuote: string,
    exitQuote: string,
    entryFee?: string,
    exitFee?: string,
  ) {
    const feesTotal = this.toBig(entryFee ?? '0').plus(exitFee ?? '0')
    const entry = this.toBig(entryQuote)
    const exit = this.toBig(exitQuote)

    const pnl =
      direction === 'LONG'
        ? exit.minus(entry).minus(feesTotal)
        : entry.minus(exit).minus(feesTotal)

    return pnl.toString()
  }

  private toBig(value: string) {
    try {
      return new Big(value)
    } catch {
      throw new BadRequestException('Invalid decimal value')
    }
  }
}
