import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'

import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { updateUserRoleSchema } from './dto/users.schemas'
import { type UserRole } from './schemas/user.schema'
import { UsersService } from './users.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async listUsers() {
    const users = await this.usersService.listUsers()
    return users.map((user) => ({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }))
  }

  @Patch(':id')
  async updateUserRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema))
    body: { role?: UserRole },
  ) {
    const target = await this.usersService.findById(id)
    if (!target) {
      throw new NotFoundException('User not found')
    }

    if (!body.role || body.role === target.role) {
      return {
        id: target._id.toString(),
        email: target.email,
        role: target.role,
        createdAt: target.createdAt,
      }
    }

    if (target.role === 'admin' && body.role === 'user') {
      const adminCount = await this.usersService.countAdmins()
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin')
      }
    }

    const updated = await this.usersService.updateRole(id, body.role)
    if (!updated) {
      throw new NotFoundException('User not found')
    }

    return {
      id: updated._id.toString(),
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
    }
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Req() req: Request) {
    const currentUser = req.user as { id?: string }
    if (currentUser?.id === id) {
      throw new BadRequestException('Cannot delete your own account')
    }

    const deleted = await this.usersService.deleteById(id)
    if (!deleted) {
      throw new NotFoundException('User not found')
    }
    return { ok: true }
  }
}
