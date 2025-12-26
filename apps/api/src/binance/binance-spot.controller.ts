import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import {
  binanceSpotCancelOrderSchema,
  binanceSpotCancelReplaceSchema,
  binanceSpotMyTradesSchema,
  binanceSpotOpenOrdersSchema,
  binanceSpotPlaceOrderSchema,
  binanceSpotQueryOrderSchema,
  type BinanceSpotCancelOrderDto,
  type BinanceSpotCancelReplaceDto,
  type BinanceSpotMyTradesQuery,
  type BinanceSpotOpenOrdersQuery,
  type BinanceSpotPlaceOrderDto,
  type BinanceSpotQueryOrderQuery,
} from './dto/binance.schemas'
import {
  BinanceFilterException,
  BinanceSpotClientService,
} from './binance-spot-client.service'

@UseGuards(JwtAuthGuard)
@Controller('binance/spot')
export class BinanceSpotController {
  constructor(private binanceSpotClient: BinanceSpotClientService) {}

  @Get('account')
  async getAccount(@Req() req: Request) {
    const user = req.user as { id: string }
    try {
      return await this.binanceSpotClient.getAccount(user.id)
    } catch (error) {
      this.handleBinanceError(error)
    }
  }

  @Get('open-orders')
  async openOrders(
    @Req() req: Request,
    @Query(new ZodValidationPipe(binanceSpotOpenOrdersSchema))
    query: BinanceSpotOpenOrdersQuery,
  ) {
    const user = req.user as { id: string }
    try {
      return await this.binanceSpotClient.openOrders(user.id, query.symbol)
    } catch (error) {
      this.handleBinanceError(error)
    }
  }

  @Post('order')
  async placeOrder(
    @Req() req: Request,
    @Body(new ZodValidationPipe(binanceSpotPlaceOrderSchema))
    body: BinanceSpotPlaceOrderDto,
  ) {
    const user = req.user as { id: string }
    const payload = {
      ...body,
      symbol: body.symbol.trim().toUpperCase(),
      timeInForce:
        body.type === 'LIMIT' ? (body.timeInForce ?? 'GTC') : undefined,
    }

    try {
      return await this.binanceSpotClient.placeOrder(user.id, payload)
    } catch (error) {
      this.handleBinanceError(error)
    }
  }

  @Delete('order')
  async cancelOrder(
    @Req() req: Request,
    @Body(new ZodValidationPipe(binanceSpotCancelOrderSchema))
    body: BinanceSpotCancelOrderDto,
  ) {
    const user = req.user as { id: string }
    try {
      return await this.binanceSpotClient.cancelOrder(user.id, body)
    } catch (error) {
      this.handleBinanceError(error)
    }
  }

  @Post('order/cancel-replace')
  async cancelReplaceOrder(
    @Req() req: Request,
    @Body(new ZodValidationPipe(binanceSpotCancelReplaceSchema))
    body: BinanceSpotCancelReplaceDto,
  ) {
    const user = req.user as { id: string }
    const payload = {
      ...body,
      symbol: body.symbol.trim().toUpperCase(),
      timeInForce: body.timeInForce ?? 'GTC',
      cancelReplaceMode: body.cancelReplaceMode ?? 'STOP_ON_FAILURE',
    }

    try {
      return await this.binanceSpotClient.cancelReplaceOrder(user.id, payload)
    } catch (error) {
      this.handleBinanceError(error)
    }
  }

  @Get('order')
  async queryOrder(
    @Req() req: Request,
    @Query(new ZodValidationPipe(binanceSpotQueryOrderSchema))
    query: BinanceSpotQueryOrderQuery,
  ) {
    const user = req.user as { id: string }
    try {
      return await this.binanceSpotClient.queryOrder(user.id, query)
    } catch (error) {
      this.handleBinanceError(error)
    }
  }

  @Get('my-trades')
  async myTrades(
    @Req() req: Request,
    @Query(new ZodValidationPipe(binanceSpotMyTradesSchema))
    query: BinanceSpotMyTradesQuery,
  ) {
    const user = req.user as { id: string }
    try {
      return await this.binanceSpotClient.getMyTrades(user.id, query)
    } catch (error) {
      this.handleBinanceError(error)
    }
  }

  private handleBinanceError(error: unknown): never {
    if (error instanceof BinanceFilterException) {
      throw new BadRequestException(error.payload)
    }

    const message =
      error instanceof Error ? error.message : 'Binance request failed.'

    if (message === 'Binance keys not configured') {
      throw new BadRequestException(message)
    }

    throw new HttpException({ ok: false, message }, HttpStatus.BAD_REQUEST)
  }
}
