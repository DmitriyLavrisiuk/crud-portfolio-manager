import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { type HydratedDocument, Types } from 'mongoose'

export type TransactionDocument = HydratedDocument<Transaction>
export type TransactionType = 'BUY' | 'SELL'

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId

  @Prop({ required: true, enum: ['BUY', 'SELL'] })
  type!: TransactionType

  @Prop({ required: true, uppercase: true, trim: true })
  symbol!: string

  @Prop({
    required: true,
    min: 0,
    validate: {
      validator: (value: number) => value > 0,
      message: 'Quantity must be positive',
    },
  })
  quantity!: number

  @Prop()
  price?: number

  @Prop()
  fee?: number

  @Prop({ trim: true })
  feeAsset?: string

  @Prop({ required: true })
  occurredAt!: Date

  @Prop({ default: 'binance', trim: true })
  exchange?: string

  @Prop({ maxlength: 500, trim: true })
  note?: string

  createdAt?: Date
  updatedAt?: Date
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction)

TransactionSchema.index({ userId: 1, occurredAt: -1 })
TransactionSchema.index({ userId: 1, symbol: 1 })
