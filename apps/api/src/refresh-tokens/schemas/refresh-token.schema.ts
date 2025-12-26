import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { type HydratedDocument, Types } from 'mongoose'

export type RefreshTokenDocument = HydratedDocument<RefreshToken>

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId

  @Prop({ required: true, index: true })
  tokenHash: string

  @Prop({ required: true })
  expiresAt: Date
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken)
