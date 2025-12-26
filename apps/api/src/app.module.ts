import path from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'

import { AppController } from './app.controller'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '..', '.env'),
        path.resolve(__dirname, '..', '..', '.env')
      ],
      expandVariables: true
    }),
    MongooseModule.forRoot(process.env.MONGO_URI as string)
  ],
  controllers: [AppController]
})
export class AppModule {}
