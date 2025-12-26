import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { type HydratedDocument, Types } from 'mongoose'

export type DealDocument = HydratedDocument<Deal>
export type DealDirection = 'LONG' | 'SHORT'
export type DealStatus = 'OPEN' | 'CLOSED'

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
