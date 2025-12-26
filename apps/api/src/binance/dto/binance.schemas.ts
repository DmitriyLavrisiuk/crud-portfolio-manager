import { z } from 'zod'

export const binanceCredentialsSchema = z.object({
  apiKey: z.string().min(10),
  apiSecret: z.string().min(10),
})

export type BinanceCredentialsDto = z.infer<typeof binanceCredentialsSchema>
