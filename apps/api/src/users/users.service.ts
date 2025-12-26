import { ConflictException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { User, type UserDocument } from './schemas/user.schema'

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() })
  }

  async findById(id: string) {
    return this.userModel.findById(id)
  }

  async createUser(params: { email: string; passwordHash: string }) {
    try {
      const created = new this.userModel({
        email: params.email.toLowerCase(),
        passwordHash: params.passwordHash
      })
      return await created.save()
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Email already registered')
      }
      throw error
    }
  }
}
