import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  validateEnv(configService)
  app.use(cookieParser())
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  })

  const port = Number(configService.get('PORT') ?? 4000)
  await app.listen(port)
}

bootstrap()

function validateEnv(configService: ConfigService) {
  const required = [
    'MONGO_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_ACCESS_TTL',
    'JWT_REFRESH_TTL',
    'COOKIE_SECURE',
  ]

  const missing = required.filter((key) => !configService.get(key))
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }

  const cookieSecure = configService.get('COOKIE_SECURE')
  if (cookieSecure !== 'true' && cookieSecure !== 'false') {
    throw new Error('COOKIE_SECURE must be "true" or "false"')
  }
}
