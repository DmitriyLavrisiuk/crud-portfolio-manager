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
  closeDealSchema,
  closeDealWithOrderSchema,
  createDealSchema,
  dealsStatsSchema,
  importTradesSchema,
  listDealsSchema,
  openDealWithOrderSchema,
  partialCloseDealSchema,
  updateDealSchema,
  type CloseDealDto,
  type CloseDealWithOrderDto,
  type CreateDealDto,
  type DealsStatsQuery,
  type ImportTradesDto,
  type ListDealsQuery,
  type OpenDealWithOrderDto,
  type PartialCloseDealDto,
  type UpdateDealDto,
} from './dto/deals.schemas'
import type { Deal } from './schemas/deal.schema'
import { DealsService } from './deals.service'

@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  constructor(private dealsService: DealsService) {}

  @Post()
  async createDeal(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createDealSchema))
    body: CreateDealDto,
  ) {
    const user = req.user as { id: string }
    const created = await this.dealsService.createDeal(user.id, body)
    return this.mapDeal(created)
  }

  @Get()
  async listDeals(
    @Req() req: Request,
    @Query(new ZodValidationPipe(listDealsSchema))
    query: ListDealsQuery,
  ) {
    const user = req.user as { id: string }
    const result = await this.dealsService.listDeals(user.id, query)

    return {
      items: result.items.map((item) => this.mapDeal(item)),
      page: result.page,
      limit: result.limit,
      total: result.total,
    }
  }

  @Get('stats')
  async getDealsStats(
    @Req() req: Request,
    @Query(new ZodValidationPipe(dealsStatsSchema))
    query: DealsStatsQuery,
  ) {
    const user = req.user as { id: string }
    return this.dealsService.getDealsStats(user.id, query)
  }

  @Get(':id')
  async getDeal(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string }
    const deal = await this.dealsService.findByIdForUser(user.id, id)
    if (!deal) {
      throw new NotFoundException('Deal not found')
    }

    return this.mapDeal(deal)
  }

  @Patch(':id')
  async updateDeal(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDealSchema))
    body: UpdateDealDto,
  ) {
    const user = req.user as { id: string }
    const updated = await this.dealsService.updateByIdForUser(user.id, id, body)
    if (!updated) {
      throw new NotFoundException('Deal not found')
    }

    return this.mapDeal(updated)
  }

  @Post(':id/close')
  async closeDeal(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(closeDealSchema))
    body: CloseDealDto,
  ) {
    const user = req.user as { id: string }
    const closed = await this.dealsService.closeDealForUser(user.id, id, body)
    if (!closed) {
      throw new NotFoundException('Deal not found')
    }

    return this.mapDeal(closed)
  }

  @Post(':id/partial-close')
  async partialCloseDeal(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(partialCloseDealSchema))
    body: PartialCloseDealDto,
  ) {
    const user = req.user as { id: string }
    const updated = await this.dealsService.partialCloseDealForUser(
      user.id,
      id,
      body,
    )
    if (!updated) {
      throw new NotFoundException('Deal not found')
    }

    return this.mapDeal(updated)
  }

  @Post('open-with-order')
  async openWithOrder(
    @Req() req: Request,
    @Body(new ZodValidationPipe(openDealWithOrderSchema))
    body: OpenDealWithOrderDto,
  ) {
    const user = req.user as { id: string }
    return this.dealsService.openDealWithOrder(user.id, body)
  }

  @Post(':id/close-with-order')
  async closeWithOrder(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(closeDealWithOrderSchema))
    body: CloseDealWithOrderDto,
  ) {
    const user = req.user as { id: string }
    const result = await this.dealsService.closeDealWithOrder(user.id, id, body)
    if (!result) {
      throw new NotFoundException('Deal not found')
    }
    return result
  }

  @Post(':id/import-trades')
  async importTrades(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(importTradesSchema))
    body: ImportTradesDto,
  ) {
    const user = req.user as { id: string }
    const result = await this.dealsService.importTradesForUser(
      user.id,
      id,
      body,
    )
    if (!result) {
      throw new NotFoundException('Deal not found')
    }

    return result
  }

  @Delete(':id')
  async deleteDeal(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string }
    const deleted = await this.dealsService.deleteByIdForUser(user.id, id)
    if (!deleted) {
      throw new NotFoundException('Deal not found')
    }
    return { ok: true }
  }

  private mapDeal(deal: HydratedDocument<Deal> | (Deal & { _id: unknown })) {
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

    return {
      ...rest,
      id: String(_id),
    }
  }
}
