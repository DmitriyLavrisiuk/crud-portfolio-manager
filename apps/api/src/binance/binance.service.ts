import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { createHmac } from 'node:crypto'
import { Model } from 'mongoose'

import { EncryptionService } from '../common/encryption.service'
import {
  BinanceCredentials,
  type BinanceCredentialsDocument,
} from './schemas/binance-credentials.schema'

type BinanceTestResult = { ok: true } | { ok: false; message: string }

const DEFAULT_BINANCE_BASE_URL = 'https://api.binance.com'
const DEFAULT_RECV_WINDOW = 5000

@Injectable()
export class BinanceService {
  constructor(
    @InjectModel(BinanceCredentials.name)
    private binanceModel: Model<BinanceCredentialsDocument>,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  async getCredentials(userId: string) {
    return this.binanceModel.findOne({ userId })
  }

  async getDecryptedCredentials(userId: string) {
    const credentials = await this.binanceModel.findOne({ userId })
    if (!credentials) {
      return null
    }

    const apiKey = this.encryptionService.decrypt(credentials.apiKeyEnc, userId)
    const apiSecret = this.encryptionService.decrypt(
      credentials.apiSecretEnc,
      userId,
    )

    return { apiKey, apiSecret }
  }

  async upsertCredentials(userId: string, apiKey: string, apiSecret: string) {
    const apiKeyEnc = this.encryptionService.encrypt(apiKey, userId)
    const apiSecretEnc = this.encryptionService.encrypt(apiSecret, userId)
    const apiKeyLast4 = apiKey.slice(-4)

    return this.binanceModel.findOneAndUpdate(
      { userId },
      {
        $set: { apiKeyEnc, apiSecretEnc, apiKeyLast4 },
        $unset: { lastTestedAt: '', lastTestOk: '', lastTestError: '' },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
  }

  async deleteCredentials(userId: string) {
    return this.binanceModel.findOneAndDelete({ userId })
  }

  async testCredentials(userId: string): Promise<BinanceTestResult> {
    const credentials = await this.binanceModel.findOne({ userId })
    if (!credentials) {
      return { ok: false, message: 'Binance credentials not found.' }
    }

    const apiKey = this.encryptionService.decrypt(credentials.apiKeyEnc, userId)
    const apiSecret = this.encryptionService.decrypt(
      credentials.apiSecretEnc,
      userId,
    )

    try {
      const timestamp = await this.getServerTime()
      const queryString = `timestamp=${timestamp}&recvWindow=${DEFAULT_RECV_WINDOW}`
      const signature = createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex')
      const url = `${this.getBaseUrl()}/api/v3/account?${queryString}&signature=${signature}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      })

      if (!response.ok) {
        const message = await this.extractBinanceError(response)
        await this.updateTestStatus(credentials, false, message)
        return { ok: false, message }
      }

      await this.updateTestStatus(credentials, true)
      return { ok: true }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to test Binance credentials.'
      await this.updateTestStatus(credentials, false, message)
      return { ok: false, message }
    }
  }

  private async updateTestStatus(
    credentials: BinanceCredentialsDocument,
    ok: boolean,
    errorMessage?: string,
  ) {
    const update: Partial<BinanceCredentials> = {
      lastTestedAt: new Date(),
      lastTestOk: ok,
    }

    if (ok) {
      update.lastTestError = undefined
    } else {
      update.lastTestError = this.sanitizeErrorMessage(errorMessage)
    }

    credentials.set(update)
    await credentials.save()
  }

  private async getServerTime(): Promise<number> {
    const response = await fetch(`${this.getBaseUrl()}/api/v3/time`)
    if (!response.ok) {
      throw new Error('Failed to fetch Binance server time.')
    }
    const data = (await response.json()) as { serverTime?: number }
    return typeof data.serverTime === 'number' ? data.serverTime : Date.now()
  }

  private getBaseUrl() {
    return (
      this.configService.get<string>('BINANCE_SPOT_BASE_URL') ??
      DEFAULT_BINANCE_BASE_URL
    )
  }

  private async extractBinanceError(response: Response) {
    try {
      const data = (await response.json()) as { code?: number; msg?: string }
      if (data?.code === -2015) {
        return 'Invalid API key, IP restriction, or missing permissions.'
      }
      if (data?.msg) {
        return data.msg
      }
    } catch {
      // ignore JSON parsing errors
    }

    return `Binance request failed (${response.status}).`
  }

  private sanitizeErrorMessage(message?: string) {
    if (!message) return 'Binance request failed.'
    return message.slice(0, 500)
  }
}
