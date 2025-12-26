import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { type UserRole } from '../users/schemas/user.schema'
import { ROLES_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!roles || roles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user as { role?: UserRole }
    if (!user?.role) {
      return false
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException('Access denied')
    }

    return true
  }
}
