import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'
import type { HydratedDocument } from 'mongoose'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import {
  createTransactionSchema,
  listTransactionsSchema,
  updateTransactionSchema,
  type CreateTransactionDto,
  type ListTransactionsQuery,
  type UpdateTransactionDto,
} from './dto/transactions.schemas'
import type { Transaction } from './schemas/transaction.schema'
import { TransactionsService } from './transactions.service'

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post()
  async createTransaction(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createTransactionSchema))
    body: CreateTransactionDto,
  ) {
    const user = req.user as { id: string }
    const created = await this.transactionsService.createTransaction(
      user.id,
      body,
    )
    return this.mapTransaction(created)
  }

  @Get()
  async listTransactions(
    @Req() req: Request,
    @Query(new ZodValidationPipe(listTransactionsSchema))
    query: ListTransactionsQuery,
  ) {
    const user = req.user as { id: string }
    const result = await this.transactionsService.listTransactions(
      user.id,
      query,
    )

    return {
      items: result.items.map((item) => this.mapTransaction(item)),
      page: result.page,
      limit: result.limit,
      total: result.total,
    }
  }

  @Get(':id')
  async getTransaction(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string }
    const transaction = await this.transactionsService.findByIdForUser(
      user.id,
      id,
    )
    if (!transaction) {
      throw new NotFoundException('Transaction not found')
    }

    return this.mapTransaction(transaction)
  }

  @Patch(':id')
  async updateTransaction(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTransactionSchema))
    body: UpdateTransactionDto,
  ) {
    const user = req.user as { id: string }
    const updated = await this.transactionsService.updateByIdForUser(
      user.id,
      id,
      body,
    )
    if (!updated) {
      throw new NotFoundException('Transaction not found')
    }

    return this.mapTransaction(updated)
  }

  @Delete(':id')
  async deleteTransaction(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string }
    const deleted = await this.transactionsService.deleteByIdForUser(
      user.id,
      id,
    )
    if (!deleted) {
      throw new NotFoundException('Transaction not found')
    }
    return { ok: true }
  }

  private mapTransaction(
    transaction:
      | HydratedDocument<Transaction>
      | (Transaction & { _id: unknown }),
  ) {
    const obj =
      typeof (transaction as { toObject?: () => Transaction }).toObject ===
      'function'
        ? (transaction as { toObject: () => Transaction }).toObject()
        : (transaction as Transaction)

    const { _id, __v, userId, ...rest } = obj as Transaction & {
      _id: unknown
      __v?: unknown
      userId?: unknown
    }
    void __v
    void userId

    return {
      ...rest,
      id: String(_id),
    }
  }
}
