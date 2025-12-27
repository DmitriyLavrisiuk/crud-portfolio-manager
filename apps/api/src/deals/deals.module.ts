import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { BinanceModule } from '../binance/binance.module'
import { DealsController } from './deals.controller'
import { DealsService } from './deals.service'
import { Deal, DealSchema } from './schemas/deal.schema'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Deal.name, schema: DealSchema }]),
    BinanceModule,
  ],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
