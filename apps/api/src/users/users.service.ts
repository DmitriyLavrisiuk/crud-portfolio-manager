import { ConflictException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { User, type UserDocument, type UserRole } from './schemas/user.schema'

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() })
  }

  async findById(id: string) {
    return this.userModel.findById(id)
  }

  async createUser(params: {
    email: string
    passwordHash: string
    role?: UserRole
  }) {
    try {
      const created = new this.userModel({
        email: params.email.toLowerCase(),
        passwordHash: params.passwordHash,
        role: params.role ?? 'user',
      })
      return await created.save()
    } catch (error: unknown) {
      const maybeError = error as { code?: number }
      if (maybeError?.code === 11000) {
        throw new ConflictException('Email already registered')
      }
      throw error
    }
  }

  async countUsers() {
    return this.userModel.countDocuments()
  }

  async countAdmins() {
    return this.userModel.countDocuments({ role: 'admin' })
  }

  async listUsers() {
    return this.userModel
      .find({}, { email: 1, role: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
  }

  async updateRole(id: string, role: UserRole) {
    return this.userModel.findByIdAndUpdate(id, { role }, { new: true })
  }

  async deleteById(id: string) {
    return this.userModel.findByIdAndDelete(id)
  }
}
