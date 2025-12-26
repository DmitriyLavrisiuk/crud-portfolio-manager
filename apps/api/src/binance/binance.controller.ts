import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import {
  binanceCredentialsSchema,
  type BinanceCredentialsDto,
} from './dto/binance.schemas'
import { BinanceService } from './binance.service'

@UseGuards(JwtAuthGuard)
@Controller('binance/credentials')
export class BinanceController {
  constructor(private binanceService: BinanceService) {}

  @Get()
  async getCredentials(@Req() req: Request) {
    const user = req.user as { id: string }
    const credentials = await this.binanceService.getCredentials(user.id)
    if (!credentials) {
      return { connected: false, apiKeyLast4: null }
    }

    return {
      connected: true,
      apiKeyLast4: credentials.apiKeyLast4,
      updatedAt: credentials.updatedAt?.toISOString(),
      lastTestedAt: credentials.lastTestedAt?.toISOString(),
      lastTestOk: credentials.lastTestOk,
      lastTestError: credentials.lastTestError,
    }
  }

  @Put()
  async upsertCredentials(
    @Req() req: Request,
    @Body(new ZodValidationPipe(binanceCredentialsSchema))
    body: BinanceCredentialsDto,
  ) {
    const user = req.user as { id: string }
    await this.binanceService.upsertCredentials(
      user.id,
      body.apiKey,
      body.apiSecret,
    )

    return { ok: true }
  }

  @Delete()
  async deleteCredentials(@Req() req: Request) {
    const user = req.user as { id: string }
    await this.binanceService.deleteCredentials(user.id)
    return { ok: true }
  }

  @Post('test')
  async testCredentials(@Req() req: Request) {
    const user = req.user as { id: string }
    return this.binanceService.testCredentials(user.id)
  }
}
