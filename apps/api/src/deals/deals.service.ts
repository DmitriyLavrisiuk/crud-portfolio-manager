import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import Big from 'big.js'
import { Model, type FilterQuery } from 'mongoose'

import {
  type CloseDealDto,
  type CreateDealDto,
  type ListDealsQuery,
  type UpdateDealDto,
} from './dto/deals.schemas'
import {
  Deal,
  type DealDirection,
  type DealDocument,
} from './schemas/deal.schema'

@Injectable()
export class DealsService {
  constructor(
    @InjectModel(Deal.name)
    private dealModel: Model<DealDocument>,
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

  async deleteByIdForUser(userId: string, id: string) {
    return this.dealModel.findOneAndDelete({ _id: id, userId })
  }

  private computeQuote(qty: string, price: string) {
    return this.toBig(qty).times(this.toBig(price)).toString()
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
