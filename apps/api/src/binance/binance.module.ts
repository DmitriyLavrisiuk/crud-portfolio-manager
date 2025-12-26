import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { EncryptionService } from '../common/encryption.service'
import { BinanceController } from './binance.controller'
import { BinanceSpotController } from './binance-spot.controller'
import { BinanceSpotClientService } from './binance-spot-client.service'
import { BinanceService } from './binance.service'
import {
  BinanceCredentials,
  BinanceCredentialsSchema,
} from './schemas/binance-credentials.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BinanceCredentials.name, schema: BinanceCredentialsSchema },
    ]),
  ],
  controllers: [BinanceController, BinanceSpotController],
  providers: [BinanceService, BinanceSpotClientService, EncryptionService],
})
export class BinanceModule {}
