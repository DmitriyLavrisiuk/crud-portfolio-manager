import path from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'

import { AppController } from './app.controller'
import { AuthModule } from './auth/auth.module'
import { BinanceModule } from './binance/binance.module'
import { RefreshTokensModule } from './refresh-tokens/refresh-tokens.module'
import { TransactionsModule } from './transactions/transactions.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '..', '.env'),
        path.resolve(__dirname, '..', '..', '.env'),
      ],
      expandVariables: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
    UsersModule,
    RefreshTokensModule,
    AuthModule,
    TransactionsModule,
    BinanceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
