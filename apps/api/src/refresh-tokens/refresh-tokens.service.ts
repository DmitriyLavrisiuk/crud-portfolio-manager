import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import {
  RefreshToken,
  type RefreshTokenDocument
} from './schemas/refresh-token.schema'

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>
  ) {}

  async create(params: {
    userId: Types.ObjectId
    tokenHash: string
    expiresAt: Date
  }) {
    const created = new this.refreshTokenModel(params)
    return created.save()
  }

  async findByHash(tokenHash: string) {
    return this.refreshTokenModel.findOne({ tokenHash })
  }

  async deleteByHash(tokenHash: string) {
    return this.refreshTokenModel.deleteOne({ tokenHash })
  }
}
