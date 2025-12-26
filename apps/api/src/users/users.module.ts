import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { RolesGuard } from '../auth/roles.guard'
import { User, UserSchema } from './schemas/user.schema'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
