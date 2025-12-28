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
  type PartialCloseDealDto,
  type AddEntryLegDto,
  type ProfitToPositionDto,
} from './dto/deals.schemas'
import {
  Deal,
  type DealDirection,
  type DealDocument,
  type DealExitLeg,
  type DealEntryLeg,
  type DealLeg,
  type TradeFill,
  type DealProfitOp,
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
      closedQty: '0',
      remainingQty: entry.qty,
      entryQtyTotal: entry.qty,
      entryQuoteTotal: entry.quote,
      entryAvgPrice: entry.price,
      profitSpentTotal: '0',
      realizedPnlAvailable: '0',
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
        { realizedPnl: 1, 'entry.fee': 1, 'exit.fee': 1, exitLegs: 1 },
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
      let exitFeesTotal = this.toBig('0')
      if (Array.isArray(deal.exitLegs) && deal.exitLegs.length > 0) {
        for (const leg of deal.exitLegs) {
          exitFeesTotal = exitFeesTotal.plus(this.toBig(String(leg.fee ?? '0')))
        }
      } else {
        exitFeesTotal = this.toBig(String(deal.exit?.fee ?? '0'))
      }
      feesTotal = feesTotal.plus(entryFee).plus(exitFeesTotal)
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
    const hasExitLegs = Array.isArray(deal.exitLegs) && deal.exitLegs.length > 0
    const hasEntryLegs =
      Array.isArray(deal.entryLegs) && deal.entryLegs.length > 0

    if (update.symbol) {
      deal.symbol = update.symbol
    }
    if (update.direction) {
      deal.direction = update.direction
      needsRecalc = deal.status === 'CLOSED' || hasExitLegs
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
      needsRecalc = deal.status === 'CLOSED' || hasExitLegs
    }

    if (needsRecalc) {
      if (hasEntryLegs) {
        this.recalcEntryLegs(deal)
      } else {
        this.applyLegacyEntryAgg(deal)
      }

      if (hasExitLegs) {
        this.recalcExitLegs(deal)
      } else if (deal.status === 'CLOSED') {
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
        this.updateRealizedAvailable(deal)
      } else {
        this.applyLegacyRemaining(deal)
      }
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

    this.ensureEntryQuote(deal)
    const remainingQty = this.getRemainingQty(deal)
    const exitLeg = this.buildExitLeg({
      qty: remainingQty,
      price: data.exit.price,
      fee: data.exit.fee,
      feeAsset: data.exit.feeAsset,
      closedAt: data.closedAt,
      source: 'MANUAL',
    })
    this.addExitLeg(deal, exitLeg)

    return deal.save()
  }

  async partialCloseDealForUser(
    userId: string,
    id: string,
    data: PartialCloseDealDto,
  ) {
    const deal = await this.dealModel.findOne({ _id: id, userId })
    if (!deal) {
      return null
    }

    if (deal.status === 'CLOSED') {
      throw new BadRequestException('Deal is already closed')
    }

    this.ensureEntryQuote(deal)
    const exitLeg = this.buildExitLeg({
      qty: data.exit.qty,
      price: data.exit.price,
      fee: data.exit.fee,
      feeAsset: data.exit.feeAsset,
      closedAt: data.closedAt ?? new Date(),
      source: 'MANUAL',
    })
    this.addExitLeg(deal, exitLeg)
    if (data.note) {
      this.appendNote(deal, data.note)
    }

    return deal.save()
  }

  async profitToPositionForUser(
    userId: string,
    id: string,
    data: ProfitToPositionDto,
  ) {
    const deal = await this.dealModel.findOne({ _id: id, userId })
    if (!deal) {
      return null
    }

    this.ensureEntryQuote(deal)
    this.applyLegacyEntryAgg(deal)
    const remainingQty = this.getRemainingQty(deal)
    if (this.toBig(remainingQty).lte(0)) {
      throw new BadRequestException('Deal is fully closed')
    }

    const realizedAvailable = this.getRealizedAvailable(deal)
    if (this.toBig(deal.realizedPnl ?? '0').lte(0)) {
      throw new BadRequestException('Realized PnL is not positive')
    }
    if (realizedAvailable.lte(0)) {
      throw new BadRequestException('No available profit')
    }

    const amount = this.toBig(data.amount)
    if (amount.gt(realizedAvailable)) {
      throw new BadRequestException('Amount exceeds available profit')
    }

    const price = this.toBig(data.price)
    if (price.lte(0)) {
      throw new BadRequestException('Price must be greater than 0')
    }

    const qty = amount.div(price).toString()
    const entryLeg = this.buildEntryLeg({
      qty,
      price: data.price,
      quote: data.amount,
      openedAt: data.at ?? new Date(),
      source: 'MANUAL',
    })

    this.addEntryLeg(deal, entryLeg, { preserveRealizedPnl: true })

    if (!deal.profitOps) {
      deal.profitOps = []
    }
    const profitOp: DealProfitOp = {
      at: data.at ?? new Date(),
      amount: data.amount,
      price: data.price,
      qty,
      note: data.note,
    }
    deal.profitOps.push(profitOp)

    const nextSpent = this.toBig(deal.profitSpentTotal ?? '0').plus(amount)
    deal.profitSpentTotal = nextSpent.toString()
    this.updateRealizedAvailable(deal)

    await deal.save()

    return {
      deal: this.mapDeal(deal),
      realizedAvailableAfter: deal.realizedPnlAvailable ?? '0',
      newEntryAgg: {
        qtyTotal: deal.entryQtyTotal ?? deal.entry.qty,
        quoteTotal: deal.entryQuoteTotal ?? deal.entry.quote,
        avgPrice: deal.entryAvgPrice ?? deal.entry.price,
      },
    }
  }

  async addEntryLegForUser(userId: string, id: string, data: AddEntryLegDto) {
    const deal = await this.dealModel.findOne({ _id: id, userId })
    if (!deal) {
      return null
    }

    if (deal.status === 'CLOSED') {
      throw new BadRequestException('Deal is already closed')
    }

    this.ensureEntryQuote(deal)
    this.applyLegacyEntryAgg(deal)
    const remainingQty = this.getRemainingQty(deal)
    if (this.toBig(remainingQty).lte(0)) {
      throw new BadRequestException('Deal has no remaining qty')
    }

    const entryLeg = this.buildEntryLeg({
      qty: data.entry.qty,
      price: data.entry.price,
      fee: data.entry.fee,
      feeAsset: data.entry.feeAsset,
      openedAt: data.openedAt ?? new Date(),
      source: 'MANUAL',
    })

    this.addEntryLeg(deal, entryLeg)

    if (data.note) {
      this.appendNote(deal, data.note)
    }

    await deal.save()

    return {
      deal: this.mapDeal(deal),
      entryAgg: {
        qtyTotal: deal.entryQtyTotal ?? deal.entry.qty,
        quoteTotal: deal.entryQuoteTotal ?? deal.entry.quote,
        avgPrice: deal.entryAvgPrice ?? deal.entry.price,
      },
      remainingQty: deal.remainingQty ?? deal.entry.qty,
    }
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
    const leg = this.requireLeg(result.leg, payload.phase)

    return {
      dealId: String(deal._id),
      phase: payload.phase,
      importedCount: result.importedCount,
      totalTradesInPhase: result.totalTrades,
      aggregate: {
        qty: leg.qty,
        price: leg.price,
        quote: leg.quote,
        fee: leg.fee,
        feeAsset: leg.feeAsset,
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
    const leg = this.requireLeg(applied.leg, 'ENTRY')

    return {
      deal: this.mapDeal(deal),
      binance: { orderId: order.orderId, side, type: 'MARKET' as const },
      importedCount: applied.importedCount,
      aggregate: {
        qty: leg.qty,
        price: leg.price,
        quote: leg.quote,
        fee: leg.fee,
        feeAsset: leg.feeAsset,
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
    this.ensureEntryQuote(deal)
    const leg = this.requireLeg(applied.leg, 'EXIT')
    const exitLeg = this.buildExitLeg({
      qty: leg.qty,
      price: leg.price,
      quote: leg.quote,
      fee: leg.fee,
      feeAsset: leg.feeAsset,
      closedAt: new Date(),
      source: 'BINANCE',
      orderId: order.orderId,
    })
    this.addExitLeg(deal, exitLeg)
    if (payload.note) {
      this.appendNote(deal, payload.note)
    }

    await deal.save()

    return {
      deal: this.mapDeal(deal),
      binance: { orderId: order.orderId, side, type: 'MARKET' as const },
      importedCount: applied.importedCount,
      aggregate: {
        qty: leg.qty,
        price: leg.price,
        quote: leg.quote,
        fee: leg.fee,
        feeAsset: leg.feeAsset,
      },
    }
  }

  async deleteByIdForUser(userId: string, id: string) {
    return this.dealModel.findOneAndDelete({ _id: id, userId })
  }

  private computeQuote(qty: string, price: string) {
    return this.toBig(qty).times(this.toBig(price)).toString()
  }

  private buildEntryLeg(input: {
    qty: string
    price: string
    quote?: string
    fee?: string
    feeAsset?: string
    openedAt: Date
    source?: 'MANUAL' | 'BINANCE'
    orderId?: number
  }): DealEntryLeg {
    const quote = input.quote ?? this.computeQuote(input.qty, input.price)
    return {
      qty: input.qty,
      price: input.price,
      quote,
      fee: input.fee,
      feeAsset: input.feeAsset,
      openedAt: input.openedAt,
      source: input.source,
      orderId: input.orderId,
    }
  }

  private ensureEntryQuote(deal: DealDocument) {
    if (!deal.entry.quote) {
      deal.entry.quote = this.computeQuote(deal.entry.qty, deal.entry.price)
    }
  }

  private buildExitLeg(input: {
    qty: string
    price: string
    quote?: string
    fee?: string
    feeAsset?: string
    closedAt: Date
    source?: 'MANUAL' | 'BINANCE'
    orderId?: number
  }): DealExitLeg {
    const quote = input.quote ?? this.computeQuote(input.qty, input.price)
    return {
      qty: input.qty,
      price: input.price,
      quote,
      fee: input.fee,
      feeAsset: input.feeAsset,
      closedAt: input.closedAt,
      source: input.source,
      orderId: input.orderId,
    }
  }

  private addExitLeg(deal: DealDocument, exitLeg: DealExitLeg) {
    this.ensureEntryQuote(deal)
    this.applyLegacyEntryAgg(deal)
    const { closedQty } = this.calcExitAgg(deal.exitLegs ?? [])
    const entryAgg = this.getEntryAgg(deal)
    const remainingQty = this.toBig(entryAgg.qtyTotal).minus(
      this.toBig(closedQty),
    )
    const exitQty = this.toBig(exitLeg.qty)
    if (exitQty.lte(0)) {
      throw new BadRequestException('Exit qty must be greater than 0')
    }
    if (exitQty.gt(remainingQty)) {
      throw new BadRequestException('Exit qty exceeds remaining qty')
    }

    if (!deal.exitLegs) {
      deal.exitLegs = []
    }
    deal.exitLegs.push(exitLeg)
    this.recalcExitLegs(deal)
  }

  private getEntryAgg(deal: DealDocument) {
    this.ensureEntryQuote(deal)
    const entryLegs = deal.entryLegs ?? []
    if (entryLegs.length === 0) {
      const qty = this.toBig(deal.entry.qty)
      const quote = this.toBig(deal.entry.quote)
      const avgPrice = qty.gt(0) ? quote.div(qty) : this.toBig('0')
      return {
        qtyTotal: qty.toString(),
        quoteTotal: quote.toString(),
        avgPrice: avgPrice.toString(),
        feeTotal: deal.entry.fee,
        feeAsset: deal.entry.feeAsset,
      }
    }

    let qtyTotal = this.toBig('0')
    let quoteTotal = this.toBig('0')
    let feeTotal = this.toBig('0')
    let feeAsset: string | undefined
    let mixedFeeAsset = false

    for (const leg of entryLegs) {
      qtyTotal = qtyTotal.plus(this.toBig(leg.qty))
      quoteTotal = quoteTotal.plus(this.toBig(leg.quote))
      feeTotal = feeTotal.plus(this.toBig(leg.fee ?? '0'))
      if (leg.feeAsset) {
        if (!feeAsset) {
          feeAsset = leg.feeAsset
        } else if (feeAsset !== leg.feeAsset) {
          mixedFeeAsset = true
        }
      }
    }

    if (mixedFeeAsset) {
      feeAsset = undefined
    }

    const avgPrice = qtyTotal.gt(0) ? quoteTotal.div(qtyTotal) : this.toBig('0')

    return {
      qtyTotal: qtyTotal.toString(),
      quoteTotal: quoteTotal.toString(),
      avgPrice: avgPrice.toString(),
      feeTotal: feeTotal.toString(),
      feeAsset,
    }
  }

  private calcExitAgg(exitLegs: DealExitLeg[]) {
    let closedQty = this.toBig('0')
    let closedQuote = this.toBig('0')
    let feesTotal = this.toBig('0')
    for (const leg of exitLegs) {
      closedQty = closedQty.plus(this.toBig(leg.qty))
      closedQuote = closedQuote.plus(this.toBig(leg.quote))
      feesTotal = feesTotal.plus(this.toBig(leg.fee ?? '0'))
    }
    return {
      closedQty: closedQty.toString(),
      closedQuote: closedQuote.toString(),
      feesTotal: feesTotal.toString(),
    }
  }

  private calcPartialPnl(
    direction: DealDirection,
    entryAvgPrice: string,
    exitLeg: DealExitLeg,
  ) {
    const exitQty = this.toBig(exitLeg.qty)
    const exitQuote = this.toBig(exitLeg.quote)
    const exitFee = this.toBig(exitLeg.fee ?? '0')
    const basis = exitQty.times(this.toBig(entryAvgPrice))
    const pnl =
      direction === 'LONG'
        ? exitQuote.minus(basis).minus(exitFee)
        : basis.minus(exitQuote).minus(exitFee)
    return pnl.toString()
  }

  private recalcExitLegs(
    deal: DealDocument,
    options: { preserveRealizedPnl?: boolean } = {},
  ) {
    const exitLegs = deal.exitLegs ?? []
    if (exitLegs.length === 0) {
      this.applyLegacyRemaining(deal)
      return
    }

    this.applyLegacyEntryAgg(deal)
    const entryAgg = this.getEntryAgg(deal)
    const aggregate = this.calcExitAgg(exitLegs)
    deal.closedQty = aggregate.closedQty
    const remainingQty = this.toBig(entryAgg.qtyTotal).minus(
      this.toBig(aggregate.closedQty),
    )
    deal.remainingQty = remainingQty.toString()

    if (!options.preserveRealizedPnl) {
      let realized = this.toBig('0')
      for (const leg of exitLegs) {
        realized = realized.plus(
          this.toBig(
            this.calcPartialPnl(deal.direction, entryAgg.avgPrice, leg),
          ),
        )
      }
      deal.realizedPnl = realized.toString()
    }
    this.updateRealizedAvailable(deal)

    if (remainingQty.eq(0)) {
      deal.status = 'CLOSED'
      deal.closedAt = exitLegs.reduce((latest, leg) => {
        if (!latest) return leg.closedAt
        return leg.closedAt > latest ? leg.closedAt : latest
      }, exitLegs[0].closedAt)
    } else {
      deal.status = 'OPEN'
      deal.closedAt = undefined
    }

    const closedQty = this.toBig(aggregate.closedQty)
    if (closedQty.gt(0)) {
      const avgExitPrice = this.toBig(aggregate.closedQuote).div(closedQty)
      deal.exit = {
        qty: aggregate.closedQty,
        price: avgExitPrice.toString(),
        quote: aggregate.closedQuote,
      }
    }
  }

  private applyLegacyRemaining(deal: DealDocument) {
    deal.closedQty = '0'
    deal.remainingQty = deal.entryQtyTotal ?? deal.entry.qty
  }

  private getRemainingQty(deal: DealDocument) {
    const entryAgg = this.getEntryAgg(deal)
    const aggregate = this.calcExitAgg(deal.exitLegs ?? [])
    return this.toBig(entryAgg.qtyTotal)
      .minus(this.toBig(aggregate.closedQty))
      .toString()
  }

  private applyLegacyEntryAgg(deal: DealDocument) {
    deal.entryQtyTotal = deal.entry.qty
    deal.entryQuoteTotal = deal.entry.quote
    deal.entryAvgPrice = deal.entry.price
  }

  private recalcEntryLegs(deal: DealDocument) {
    const entryAgg = this.getEntryAgg(deal)
    deal.entryQtyTotal = entryAgg.qtyTotal
    deal.entryQuoteTotal = entryAgg.quoteTotal
    deal.entryAvgPrice = entryAgg.avgPrice
    deal.entry.qty = entryAgg.qtyTotal
    deal.entry.quote = entryAgg.quoteTotal
    deal.entry.price = entryAgg.avgPrice
  }

  private addEntryLeg(
    deal: DealDocument,
    entryLeg: DealEntryLeg,
    options: { preserveRealizedPnl?: boolean } = {},
  ) {
    if (!deal.entryLegs || deal.entryLegs.length === 0) {
      deal.entryLegs = []
      if (deal.entry.qty && deal.entry.price && deal.entry.quote) {
        const legacyLeg = this.buildEntryLeg({
          qty: deal.entry.qty,
          price: deal.entry.price,
          quote: deal.entry.quote,
          fee: deal.entry.fee,
          feeAsset: deal.entry.feeAsset,
          openedAt: deal.openedAt ?? new Date(),
          source: 'MANUAL',
        })
        deal.entryLegs.push(legacyLeg)
      }
    }
    deal.entryLegs.push(entryLeg)
    this.recalcEntryLegs(deal)
    this.recalcExitLegs(deal, options)
  }

  private getRealizedAvailable(deal: DealDocument) {
    const realized = this.toBig(deal.realizedPnl ?? '0')
    const spent = this.toBig(deal.profitSpentTotal ?? '0')
    return realized.minus(spent)
  }

  private updateRealizedAvailable(deal: DealDocument) {
    const available = this.getRealizedAvailable(deal)
    deal.realizedPnlAvailable = available.toString()
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

    const hasExitLegs = Array.isArray(deal.exitLegs) && deal.exitLegs.length > 0
    if (deal.status === 'CLOSED' && deal.exit && !hasExitLegs) {
      deal.realizedPnl = this.computePnl(
        deal.direction,
        deal.entry.quote,
        deal.exit.quote,
        deal.entry.fee,
        deal.exit.fee,
      )
      this.updateRealizedAvailable(deal)
    }
    if (phase === 'ENTRY') {
      const hasEntryLegs =
        Array.isArray(deal.entryLegs) && deal.entryLegs.length > 0
      if (hasEntryLegs) {
        this.recalcEntryLegs(deal)
      } else {
        this.applyLegacyEntryAgg(deal)
      }
      if (hasExitLegs) {
        this.recalcExitLegs(deal)
      } else {
        this.applyLegacyRemaining(deal)
      }
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

  private requireLeg(leg: DealLeg | undefined, phase: 'ENTRY' | 'EXIT') {
    if (!leg) {
      throw new BadRequestException(`${phase} leg is required`)
    }
    return leg
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
