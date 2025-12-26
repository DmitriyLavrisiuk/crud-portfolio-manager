import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID, createHmac } from 'node:crypto'
import Big from 'big.js'

import { BinanceService } from './binance.service'

const DEFAULT_BINANCE_BASE_URL = 'https://api.binance.com'
const DEFAULT_RECV_WINDOW = 5000

type BinanceErrorPayload = {
  code?: number
  msg?: string
}

type SignedRequestParams = Record<string, string | number | boolean | undefined>

type ExchangeInfoFilter = {
  filterType: string
  minQty?: string
  maxQty?: string
  stepSize?: string
  minPrice?: string
  maxPrice?: string
  tickSize?: string
  minNotional?: string
}

type ExchangeInfoSnapshot = {
  baseAsset: string
  quoteAsset: string
  cancelReplaceAllowed: boolean
  filters: {
    lotSize?: ExchangeInfoFilter
    priceFilter?: ExchangeInfoFilter
    notional?: ExchangeInfoFilter
  }
}

export class BinanceFilterException extends Error {
  readonly payload: {
    code: 'BINANCE_FILTER_FAILURE'
    filter: 'NOTIONAL' | 'LOT_SIZE' | 'PRICE_FILTER'
    symbol: string
    message: string
    details: Record<string, string>
  }

  constructor(payload: BinanceFilterException['payload']) {
    super(payload.message)
    this.payload = payload
  }
}

@Injectable()
export class BinanceSpotClientService {
  private readonly exchangeInfoCache = new Map<
    string,
    { value: ExchangeInfoSnapshot; expiresAt: number }
  >()
  private readonly exchangeInfoTtlMs = 5 * 60 * 1000

  constructor(
    private configService: ConfigService,
    private binanceService: BinanceService,
  ) {}

  async getServerTime() {
    const response = await fetch(`${this.getBaseUrl()}/api/v3/time`)
    if (!response.ok) {
      throw new Error('Failed to fetch Binance server time.')
    }
    const data = (await response.json()) as { serverTime?: number }
    return typeof data.serverTime === 'number' ? data.serverTime : Date.now()
  }

  async getAccount(userId: string) {
    const credentials = await this.getCredentials(userId)
    const data = await this.signedRequest<{
      accountType?: string
      permissions?: string[]
      balances?: Array<{ asset: string; free: string; locked: string }>
    }>('GET', '/api/v3/account', credentials)

    return {
      accountType: data.accountType,
      permissions: data.permissions,
      balances: (data.balances ?? []).map((balance) => ({
        asset: balance.asset,
        free: balance.free,
        locked: balance.locked,
      })),
    }
  }

  async getTickerPrice(symbol: string) {
    const response = await fetch(
      `${this.getBaseUrl()}/api/v3/ticker/price?symbol=${encodeURIComponent(
        symbol,
      )}`,
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Binance ticker price.')
    }
    const data = (await response.json()) as { price?: string }
    if (!data?.price) {
      throw new Error('Binance ticker price unavailable.')
    }
    return data.price
  }

  async getExchangeInfo(symbol: string) {
    const cacheKey = symbol.toUpperCase()
    const cached = this.exchangeInfoCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const response = await fetch(
      `${this.getBaseUrl()}/api/v3/exchangeInfo?symbol=${encodeURIComponent(
        symbol,
      )}`,
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Binance exchange info.')
    }
    const data = (await response.json()) as {
      symbols?: Array<{
        baseAsset?: string
        quoteAsset?: string
        filters?: ExchangeInfoFilter[]
        cancelReplaceAllowed?: boolean
      }>
    }
    const info = data.symbols?.[0]
    if (!info?.baseAsset || !info?.quoteAsset) {
      throw new Error('Binance exchange info unavailable.')
    }

    const filters = info.filters ?? []
    const snapshot: ExchangeInfoSnapshot = {
      baseAsset: info.baseAsset,
      quoteAsset: info.quoteAsset,
      cancelReplaceAllowed: Boolean(info.cancelReplaceAllowed),
      filters: {
        lotSize: filters.find((filter) => filter.filterType === 'LOT_SIZE'),
        priceFilter: filters.find(
          (filter) => filter.filterType === 'PRICE_FILTER',
        ),
        notional:
          filters.find((filter) => filter.filterType === 'NOTIONAL') ??
          filters.find((filter) => filter.filterType === 'MIN_NOTIONAL'),
      },
    }

    this.exchangeInfoCache.set(cacheKey, {
      value: snapshot,
      expiresAt: Date.now() + this.exchangeInfoTtlMs,
    })

    return snapshot
  }

  async placeOrder(
    userId: string,
    payload: {
      symbol: string
      side: 'BUY' | 'SELL'
      type: 'MARKET' | 'LIMIT'
      quantity?: string
      quoteOrderQty?: string
      price?: string
      timeInForce?: 'GTC'
    },
  ) {
    const credentials = await this.getCredentials(userId)
    await this.preflightCheck(payload, credentials)
    const params: SignedRequestParams = {
      symbol: payload.symbol,
      side: payload.side,
      type: payload.type,
      quantity: payload.quantity,
      quoteOrderQty: payload.quoteOrderQty,
      price: payload.price,
      timeInForce: payload.timeInForce,
      newClientOrderId: randomUUID(),
    }

    return this.signedRequest('POST', '/api/v3/order', credentials, params)
  }

  async cancelReplaceOrder(
    userId: string,
    payload: {
      symbol: string
      cancelOrderId?: string
      cancelOrigClientOrderId?: string
      cancelReplaceMode: 'STOP_ON_FAILURE'
      side: 'BUY' | 'SELL'
      type: 'LIMIT'
      timeInForce: 'GTC'
      quantity: string
      price: string
    },
  ) {
    const credentials = await this.getCredentials(userId)
    const exchangeInfo = await this.getExchangeInfo(payload.symbol)
    await this.preflightCheck(
      {
        symbol: payload.symbol,
        side: payload.side,
        type: payload.type,
        quantity: payload.quantity,
        price: payload.price,
      },
      credentials,
    )

    if (!exchangeInfo.cancelReplaceAllowed) {
      const cancel = await this.cancelOrder(userId, {
        symbol: payload.symbol,
        orderId: payload.cancelOrderId,
        origClientOrderId: payload.cancelOrigClientOrderId,
      })
      const newOrder = await this.placeOrder(userId, {
        symbol: payload.symbol,
        side: payload.side,
        type: 'LIMIT',
        quantity: payload.quantity,
        price: payload.price,
        timeInForce: payload.timeInForce,
      })

      return { mode: 'FALLBACK_CANCEL_NEW', cancel, newOrder }
    }

    const params: SignedRequestParams = {
      symbol: payload.symbol,
      cancelOrderId: payload.cancelOrderId,
      cancelOrigClientOrderId: payload.cancelOrigClientOrderId,
      cancelReplaceMode: payload.cancelReplaceMode,
      side: payload.side,
      type: payload.type,
      timeInForce: payload.timeInForce,
      quantity: payload.quantity,
      price: payload.price,
      newClientOrderId: randomUUID(),
    }

    return this.signedRequest(
      'POST',
      '/api/v3/order/cancelReplace',
      credentials,
      params,
    )
  }

  async cancelOrder(
    userId: string,
    payload: { symbol: string; orderId?: string; origClientOrderId?: string },
  ) {
    const credentials = await this.getCredentials(userId)
    await this.signedRequest('DELETE', '/api/v3/order', credentials, payload)
    return { ok: true }
  }

  async openOrders(userId: string, symbol: string) {
    if (!symbol) {
      throw new Error('Symbol is required for open orders.')
    }
    const credentials = await this.getCredentials(userId)
    return this.signedRequest('GET', '/api/v3/openOrders', credentials, {
      symbol,
    })
  }

  async queryOrder(
    userId: string,
    payload: { symbol: string; orderId?: string; origClientOrderId?: string },
  ) {
    const credentials = await this.getCredentials(userId)
    return this.signedRequest('GET', '/api/v3/order', credentials, payload)
  }

  async getMyTrades(
    userId: string,
    payload: {
      symbol: string
      startTime?: number
      endTime?: number
      fromId?: number
      limit?: number
    },
  ) {
    const credentials = await this.getCredentials(userId)
    const data = await this.signedRequest<
      Array<{
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
      }>
    >('GET', '/api/v3/myTrades', credentials, payload)

    return data.map((trade) => ({
      id: trade.id,
      orderId: trade.orderId,
      price: trade.price,
      qty: trade.qty,
      quoteQty: trade.quoteQty,
      commission: trade.commission,
      commissionAsset: trade.commissionAsset,
      time: trade.time,
      isBuyer: trade.isBuyer,
      isMaker: trade.isMaker,
    }))
  }

  private async getCredentials(userId: string) {
    const credentials =
      await this.binanceService.getDecryptedCredentials(userId)
    if (!credentials) {
      throw new Error('Binance keys not configured')
    }
    return credentials
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    credentials: { apiKey: string; apiSecret: string },
    params: SignedRequestParams = {},
  ): Promise<T> {
    const timestamp = await this.getServerTime()
    const recvWindow = params.recvWindow ?? DEFAULT_RECV_WINDOW
    const payload: Record<string, string | number | boolean> = {}

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return
      payload[key] = value
    })
    payload.timestamp = timestamp
    payload.recvWindow = recvWindow

    const signedQuery = this.buildSignedQuery(payload, credentials.apiSecret)
    const url = `${this.getBaseUrl()}${path}?${signedQuery}`

    const response = await fetch(url, {
      method,
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
      },
    })

    if (!response.ok) {
      const error = await this.extractBinanceError(
        response,
        typeof params.symbol === 'string' ? params.symbol : undefined,
      )
      if (error instanceof BinanceFilterException) {
        throw error
      }
      throw new Error(error)
    }

    return (await response.json()) as T
  }

  private buildSignedQuery(
    params: Record<string, string | number | boolean>,
    secret: string,
  ) {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value))
    })
    const encodedQuery = queryParams.toString()
    // Signature must be computed over the percent-encoded query string.
    const signature = createHmac('sha256', secret)
      .update(encodedQuery)
      .digest('hex')
    return `${encodedQuery}&signature=${signature}`
  }

  private async preflightCheck(
    payload: {
      symbol: string
      side: 'BUY' | 'SELL'
      type: 'MARKET' | 'LIMIT'
      quantity?: string
      quoteOrderQty?: string
      price?: string
    },
    credentials: { apiKey: string; apiSecret: string },
  ) {
    const { baseAsset, quoteAsset, filters } = await this.getExchangeInfo(
      payload.symbol,
    )
    const balances = await this.getAccountBalances(credentials)
    const freeBase = balances.get(baseAsset) ?? new Big(0)
    const freeQuote = balances.get(quoteAsset) ?? new Big(0)

    if (payload.quantity && filters.lotSize) {
      this.validateLotSize(payload.symbol, payload.quantity, filters.lotSize)
    }

    if (payload.price && filters.priceFilter) {
      this.validatePriceFilter(
        payload.symbol,
        payload.price,
        filters.priceFilter,
      )
    }

    await this.validateNotional(
      payload,
      filters.notional,
      payload.symbol,
      quoteAsset,
      baseAsset,
    )

    if (payload.side === 'BUY') {
      if (payload.quoteOrderQty) {
        const required = new Big(payload.quoteOrderQty)
        if (freeQuote.lt(required)) {
          throw new Error(
            `Insufficient ${quoteAsset} balance: need ${required.toString()} ${quoteAsset}, available ${freeQuote.toString()} (free). Try smaller size.`,
          )
        }
        return
      }

      if (payload.quantity) {
        const isLimit = payload.type === 'LIMIT' && Boolean(payload.price)
        const price = isLimit
          ? (payload.price as string)
          : await this.getTickerPrice(payload.symbol)
        const baseCost = new Big(payload.quantity).times(price)
        const required = isLimit ? baseCost : baseCost.times('1.002')
        if (freeQuote.lt(required)) {
          const hint = isLimit
            ? 'Try smaller size.'
            : 'Try smaller size or use quoteOrderQty for MARKET BUY.'
          throw new Error(
            `Insufficient ${quoteAsset} balance: need ~${required.toString()} ${quoteAsset}, available ${freeQuote.toString()} (free). ${hint}`,
          )
        }
      }
      return
    }

    if (payload.side === 'SELL' && payload.quantity) {
      const required = new Big(payload.quantity)
      if (freeBase.lt(required)) {
        throw new Error(
          `Insufficient ${baseAsset} balance: need ${required.toString()} ${baseAsset}, available ${freeBase.toString()} (free).`,
        )
      }
    }
  }

  private validateLotSize(
    symbol: string,
    quantity: string,
    filter: ExchangeInfoFilter,
  ) {
    const qty = new Big(quantity)
    const minQty = filter.minQty ? new Big(filter.minQty) : null
    const maxQty = filter.maxQty ? new Big(filter.maxQty) : null
    const stepSize = filter.stepSize ? new Big(filter.stepSize) : null

    if (minQty && qty.lt(minQty)) {
      throw new BinanceFilterException({
        code: 'BINANCE_FILTER_FAILURE',
        filter: 'LOT_SIZE',
        symbol,
        message: 'Filter failure: LOT_SIZE',
        details: {
          minQty: minQty.toString(),
          quantity: qty.toString(),
        },
      })
    }

    if (maxQty && qty.gt(maxQty)) {
      throw new BinanceFilterException({
        code: 'BINANCE_FILTER_FAILURE',
        filter: 'LOT_SIZE',
        symbol,
        message: 'Filter failure: LOT_SIZE',
        details: {
          maxQty: maxQty.toString(),
          quantity: qty.toString(),
        },
      })
    }

    if (stepSize && minQty) {
      const offset = qty.minus(minQty)
      if (offset.lt(0) || !this.isStepAligned(offset, stepSize)) {
        throw new BinanceFilterException({
          code: 'BINANCE_FILTER_FAILURE',
          filter: 'LOT_SIZE',
          symbol,
          message: 'Filter failure: LOT_SIZE',
          details: {
            stepSize: stepSize.toString(),
            quantity: qty.toString(),
          },
        })
      }
    }
  }

  private validatePriceFilter(
    symbol: string,
    price: string,
    filter: ExchangeInfoFilter,
  ) {
    const value = new Big(price)
    const minPrice = filter.minPrice ? new Big(filter.minPrice) : null
    const maxPrice = filter.maxPrice ? new Big(filter.maxPrice) : null
    const tickSize = filter.tickSize ? new Big(filter.tickSize) : null

    if (minPrice && value.lt(minPrice)) {
      throw new BinanceFilterException({
        code: 'BINANCE_FILTER_FAILURE',
        filter: 'PRICE_FILTER',
        symbol,
        message: 'Filter failure: PRICE_FILTER',
        details: {
          minPrice: minPrice.toString(),
          price: value.toString(),
        },
      })
    }

    if (maxPrice && value.gt(maxPrice)) {
      throw new BinanceFilterException({
        code: 'BINANCE_FILTER_FAILURE',
        filter: 'PRICE_FILTER',
        symbol,
        message: 'Filter failure: PRICE_FILTER',
        details: {
          maxPrice: maxPrice.toString(),
          price: value.toString(),
        },
      })
    }

    if (tickSize) {
      if (!this.isStepAligned(value, tickSize)) {
        throw new BinanceFilterException({
          code: 'BINANCE_FILTER_FAILURE',
          filter: 'PRICE_FILTER',
          symbol,
          message: 'Filter failure: PRICE_FILTER',
          details: {
            tickSize: tickSize.toString(),
            price: value.toString(),
          },
        })
      }
    }
  }

  private async validateNotional(
    payload: {
      symbol: string
      side: 'BUY' | 'SELL'
      type: 'MARKET' | 'LIMIT'
      quantity?: string
      quoteOrderQty?: string
      price?: string
    },
    filter: ExchangeInfoFilter | undefined,
    symbol: string,
    quoteAsset: string,
    baseAsset: string,
  ) {
    if (!filter?.minNotional) return
    const minNotional = new Big(filter.minNotional)
    let notional: Big | null = null

    if (payload.type === 'LIMIT' && payload.price && payload.quantity) {
      notional = new Big(payload.price).times(payload.quantity)
    }

    if (payload.type === 'MARKET') {
      if (payload.side === 'BUY') {
        if (payload.quoteOrderQty) {
          notional = new Big(payload.quoteOrderQty)
        } else if (payload.quantity) {
          const price = await this.getTickerPrice(payload.symbol)
          notional = new Big(payload.quantity).times(price).times('1.002')
        }
      }

      if (payload.side === 'SELL' && payload.quantity) {
        const price = await this.getTickerPrice(payload.symbol)
        notional = new Big(payload.quantity).times(price)
      }
    }

    if (notional && notional.lt(minNotional)) {
      throw new BinanceFilterException({
        code: 'BINANCE_FILTER_FAILURE',
        filter: 'NOTIONAL',
        symbol,
        message: 'Filter failure: NOTIONAL',
        details: {
          minNotional: minNotional.toString(),
          notional: notional.toString(),
          quoteAsset,
          baseAsset,
        },
      })
    }
  }

  private isStepAligned(value: Big, step: Big) {
    if (step.eq(0)) return true
    const steps = value.div(step)
    return steps.round(0, 0).eq(steps)
  }

  private async getAccountBalances(credentials: {
    apiKey: string
    apiSecret: string
  }) {
    const data = await this.signedRequest<{
      balances?: Array<{ asset: string; free: string }>
    }>('GET', '/api/v3/account', credentials)
    const map = new Map<string, Big>()
    for (const balance of data.balances ?? []) {
      if (!balance.asset || balance.free === undefined) continue
      try {
        map.set(balance.asset, new Big(balance.free))
      } catch {
        // ignore invalid numbers
      }
    }
    return map
  }

  private getBaseUrl() {
    return (
      this.configService.get<string>('BINANCE_SPOT_BASE_URL') ??
      DEFAULT_BINANCE_BASE_URL
    )
  }

  private async extractBinanceError(response: Response, symbol?: string) {
    try {
      const data = (await response.json()) as BinanceErrorPayload
      if (data?.code === -2015 || data?.code === -2014) {
        return 'Invalid API key, IP restriction, or missing permissions.'
      }
      if (data?.code === -2010) {
        if (data?.msg?.includes('Filter failure:')) {
          const filter = this.parseFilterFailure(data.msg)
          if (filter) {
            return new BinanceFilterException({
              code: 'BINANCE_FILTER_FAILURE',
              filter,
              symbol: symbol ?? 'UNKNOWN',
              message: `Filter failure: ${filter}`,
              details: {},
            })
          }
        }
        return 'Insufficient balance for this order. Check available funds or use quoteOrderQty for MARKET BUY.'
      }
      if (data?.msg) {
        return this.sanitizeMessage(data.msg)
      }
    } catch {
      // ignore JSON parsing errors
    }

    return `Binance request failed (${response.status}).`
  }

  private sanitizeMessage(message: string) {
    return message
      .replace(/(signature|apiKey|secret)=([^&\s]+)/gi, '$1=[redacted]')
      .slice(0, 500)
  }

  private parseFilterFailure(message: string) {
    const match = message.match(/Filter failure:\s*([A-Z_]+)/i)
    if (!match) return null
    const filter = match[1]?.toUpperCase()
    if (
      filter === 'NOTIONAL' ||
      filter === 'LOT_SIZE' ||
      filter === 'PRICE_FILTER'
    ) {
      return filter as 'NOTIONAL' | 'LOT_SIZE' | 'PRICE_FILTER'
    }
    return null
  }
}
