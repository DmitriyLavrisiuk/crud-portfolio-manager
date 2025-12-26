import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, type FilterQuery } from 'mongoose'

import {
  Transaction,
  type TransactionDocument,
} from './schemas/transaction.schema'
import {
  type CreateTransactionDto,
  type ListTransactionsQuery,
  type UpdateTransactionDto,
} from './dto/transactions.schemas'

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
  ) {}

  async createTransaction(userId: string, data: CreateTransactionDto) {
    const created = new this.transactionModel({
      userId,
      ...data,
    })
    return created.save()
  }

  async listTransactions(userId: string, query: ListTransactionsQuery) {
    const filter: FilterQuery<TransactionDocument> = { userId }

    if (query.symbol) {
      filter.symbol = query.symbol
    }

    if (query.type) {
      filter.type = query.type
    }

    if (query.from || query.to) {
      filter.occurredAt = {}
      if (query.from) {
        filter.occurredAt.$gte = query.from
      }
      if (query.to) {
        filter.occurredAt.$lte = query.to
      }
    }

    const page = query.page && query.page > 0 ? query.page : 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      this.transactionModel.countDocuments(filter),
    ])

    return { items, total, page, limit }
  }

  async findByIdForUser(userId: string, id: string) {
    return this.transactionModel.findOne({ _id: id, userId })
  }

  async updateByIdForUser(
    userId: string,
    id: string,
    update: UpdateTransactionDto,
  ) {
    return this.transactionModel.findOneAndUpdate({ _id: id, userId }, update, {
      new: true,
    })
  }

  async deleteByIdForUser(userId: string, id: string) {
    return this.transactionModel.findOneAndDelete({ _id: id, userId })
  }
}
