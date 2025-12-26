import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  const mongoUri = configService.get<string>('MONGO_URI')
  if (!mongoUri) {
    throw new Error('MONGO_URI is required to start the API')
  }
  app.enableCors({
    origin: 'http://localhost:5173'
  })

  const port = Number(configService.get('PORT') ?? 4000)
  await app.listen(port)
}

bootstrap()
