import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { type HydratedDocument, Types } from 'mongoose'

export type DealDocument = HydratedDocument<Deal>
export type DealDirection = 'LONG' | 'SHORT'
export type DealStatus = 'OPEN' | 'CLOSED'
export type ExitLegSource = 'MANUAL' | 'BINANCE'

@Schema({ _id: false })
export class TradeFill {
  @Prop({ required: true })
  id!: number

  @Prop({ required: true })
  orderId!: number

  @Prop({ required: true, trim: true })
  price!: string

  @Prop({ required: true, trim: true })
  qty!: string

  @Prop({ required: true, trim: true })
  quoteQty!: string

  @Prop({ required: true, trim: true })
  commission!: string

  @Prop({ required: true, trim: true })
  commissionAsset!: string

  @Prop({ required: true })
  time!: number

  @Prop({ required: true })
  isBuyer!: boolean

  @Prop({ required: true })
  isMaker!: boolean
}

export const TradeFillSchema = SchemaFactory.createForClass(TradeFill)

@Schema({ _id: false })
export class DealLeg {
  @Prop({ required: true, trim: true })
  qty!: string

  @Prop({ required: true, trim: true })
  price!: string

  @Prop({ required: true, trim: true })
  quote!: string

  @Prop({ trim: true })
  fee?: string

  @Prop({ trim: true })
  feeAsset?: string
}

export const DealLegSchema = SchemaFactory.createForClass(DealLeg)

@Schema({ _id: false })
export class DealExitLeg {
  @Prop({ required: true, trim: true })
  qty!: string

  @Prop({ required: true, trim: true })
  price!: string

  @Prop({ required: true, trim: true })
  quote!: string

  @Prop({ trim: true })
  fee?: string

  @Prop({ trim: true })
  feeAsset?: string

  @Prop({ required: true })
  closedAt!: Date

  @Prop({ enum: ['MANUAL', 'BINANCE'] })
  source?: ExitLegSource

  @Prop()
  orderId?: number
}

export const DealExitLegSchema = SchemaFactory.createForClass(DealExitLeg)

@Schema({ timestamps: true })
export class Deal {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId

  @Prop({ required: true, uppercase: true, trim: true })
  symbol!: string

  @Prop({ required: true, enum: ['LONG', 'SHORT'] })
  direction!: DealDirection

  @Prop({ required: true, enum: ['OPEN', 'CLOSED'], default: 'OPEN' })
  status!: DealStatus

  @Prop({ required: true })
  openedAt!: Date

  @Prop()
  closedAt?: Date

  @Prop({ type: DealLegSchema, required: true })
  entry!: DealLeg

  @Prop({ type: DealLegSchema })
  exit?: DealLeg

  @Prop({ type: [DealExitLegSchema] })
  exitLegs?: DealExitLeg[]

  @Prop({ type: [TradeFillSchema] })
  entryTrades?: TradeFill[]

  @Prop({ type: [TradeFillSchema] })
  exitTrades?: TradeFill[]

  @Prop({ trim: true })
  closedQty?: string

  @Prop({ trim: true })
  remainingQty?: string

  @Prop({ trim: true })
  realizedPnl?: string

  @Prop({ maxlength: 500, trim: true })
  note?: string

  createdAt?: Date
  updatedAt?: Date
}

export const DealSchema = SchemaFactory.createForClass(Deal)

DealSchema.index({ userId: 1, openedAt: -1 })
DealSchema.index({ userId: 1, symbol: 1 })
