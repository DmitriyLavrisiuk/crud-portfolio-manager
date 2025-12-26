import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { type HydratedDocument, Types } from 'mongoose'

import { type EncryptedString } from '../../common/encryption.service'

export type BinanceCredentialsDocument = HydratedDocument<BinanceCredentials>

@Schema({ _id: false })
export class EncryptedStringSchemaClass {
  @Prop({ required: true })
  v!: number

  @Prop({ required: true })
  iv!: string

  @Prop({ required: true })
  tag!: string

  @Prop({ required: true })
  data!: string
}

const EncryptedStringSchema = SchemaFactory.createForClass(
  EncryptedStringSchemaClass,
)

@Schema({ timestamps: true })
export class BinanceCredentials {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId

  @Prop({ type: EncryptedStringSchema, required: true })
  apiKeyEnc!: EncryptedString

  @Prop({ type: EncryptedStringSchema, required: true })
  apiSecretEnc!: EncryptedString

  @Prop({ required: true, trim: true })
  apiKeyLast4!: string

  @Prop()
  lastTestedAt?: Date

  @Prop()
  lastTestOk?: boolean

  @Prop({ maxlength: 500, trim: true })
  lastTestError?: string

  createdAt?: Date
  updatedAt?: Date
}

export const BinanceCredentialsSchema =
  SchemaFactory.createForClass(BinanceCredentials)
