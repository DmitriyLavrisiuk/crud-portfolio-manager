import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  value === '' || value === null ? undefined : value

const uppercaseSymbolSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase')

const baseTransactionSchema = z.object({
  type: z.enum(['BUY', 'SELL']),
  symbol: uppercaseSymbolSchema,
  quantity: z.number().positive(),
  price: z.number().nonnegative().optional(),
  fee: z.number().nonnegative().optional(),
  feeAsset: z.string().trim().min(1).optional(),
  occurredAt: z.coerce.date(),
  exchange: z.string().trim().min(1).optional(),
  note: z.string().trim().max(500).optional(),
})

export const createTransactionSchema = baseTransactionSchema

export const updateTransactionSchema = baseTransactionSchema.partial()

export const listTransactionsSchema = z.object({
  from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  symbol: z.preprocess(emptyToUndefined, uppercaseSymbolSchema.optional()),
  type: z.preprocess(emptyToUndefined, z.enum(['BUY', 'SELL']).optional()),
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
})

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>
export type UpdateTransactionDto = z.infer<typeof updateTransactionSchema>
export type ListTransactionsQuery = z.infer<typeof listTransactionsSchema>
