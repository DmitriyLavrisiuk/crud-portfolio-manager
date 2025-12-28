import Big from 'big.js'
import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  value === '' || value === null ? undefined : value

const uppercaseSymbolSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase')

const decimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Value must be a decimal string')

const positiveDecimalStringSchema = decimalStringSchema.refine((value) => {
  try {
    return new Big(value).gt(0)
  } catch {
    return false
  }
}, 'Value must be greater than 0')

const nonNegativeDecimalStringSchema = decimalStringSchema.refine((value) => {
  try {
    return new Big(value).gte(0)
  } catch {
    return false
  }
}, 'Value must be non-negative')

const legInputSchema = z.object({
  qty: positiveDecimalStringSchema,
  price: positiveDecimalStringSchema,
  fee: nonNegativeDecimalStringSchema.optional(),
  feeAsset: z.string().trim().min(1).optional(),
})

export const createDealSchema = z.object({
  symbol: uppercaseSymbolSchema,
  direction: z.enum(['LONG', 'SHORT']),
  openedAt: z.coerce.date(),
  note: z.string().trim().max(500).optional(),
  entry: legInputSchema,
})

export const updateDealSchema = z.object({
  symbol: uppercaseSymbolSchema.optional(),
  direction: z.enum(['LONG', 'SHORT']).optional(),
  openedAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
  entry: legInputSchema.partial().optional(),
})

export const closeDealSchema = z.object({
  closedAt: z.coerce.date(),
  exit: legInputSchema,
})

export const partialCloseDealSchema = z.object({
  closedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  exit: legInputSchema,
  note: z.string().trim().max(500).optional(),
})

export const addEntryLegSchema = z.object({
  openedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  entry: legInputSchema,
  note: z.string().trim().max(500).optional(),
})

export const profitToPositionSchema = z.object({
  amount: positiveDecimalStringSchema,
  price: positiveDecimalStringSchema,
  at: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  note: z.string().trim().max(200).optional(),
})

export const listDealsSchema = z.object({
  from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['OPEN', 'CLOSED', 'ALL']).optional(),
  ),
  symbol: z.preprocess(emptyToUndefined, uppercaseSymbolSchema.optional()),
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
})

export const dealsStatsSchema = z.object({
  from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['OPEN', 'CLOSED', 'ALL']).optional(),
  ),
  symbol: z.preprocess(emptyToUndefined, uppercaseSymbolSchema.optional()),
})

export const openDealWithOrderSchema = z.object({
  symbol: uppercaseSymbolSchema,
  direction: z.enum(['LONG', 'SHORT']),
  marketBuyMode: z.enum(['QUOTE', 'BASE']).optional(),
  quoteOrderQty: positiveDecimalStringSchema.optional(),
  quantity: positiveDecimalStringSchema.optional(),
  note: z.string().trim().max(500).optional(),
})

export const closeDealWithOrderSchema = z.object({
  marketBuyMode: z.enum(['QUOTE', 'BASE']).optional(),
  quoteOrderQty: positiveDecimalStringSchema.optional(),
  quantity: positiveDecimalStringSchema.optional(),
  note: z.string().trim().max(500).optional(),
})

export const importTradesSchema = z
  .object({
    phase: z.enum(['ENTRY', 'EXIT']),
    symbol: uppercaseSymbolSchema.optional(),
    orderId: z.coerce.number().int().positive(),
    startTime: z.coerce.number().int().nonnegative().optional(),
    endTime: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .superRefine((values, ctx) => {
    const hasStart = values.startTime !== undefined
    const hasEnd = values.endTime !== undefined
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide both startTime and endTime',
        path: ['startTime'],
      })
      return
    }
    if (values.startTime !== undefined && values.endTime !== undefined) {
      if (values.endTime < values.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endTime must be >= startTime',
          path: ['endTime'],
        })
      }
      const maxWindow = 24 * 60 * 60 * 1000
      if (values.endTime - values.startTime > maxWindow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Time window must be within 24 hours',
          path: ['endTime'],
        })
      }
    }
  })

export type CreateDealDto = z.infer<typeof createDealSchema>
export type UpdateDealDto = z.infer<typeof updateDealSchema>
export type CloseDealDto = z.infer<typeof closeDealSchema>
export type PartialCloseDealDto = z.infer<typeof partialCloseDealSchema>
export type AddEntryLegDto = z.infer<typeof addEntryLegSchema>
export type ProfitToPositionDto = z.infer<typeof profitToPositionSchema>
export type ListDealsQuery = z.infer<typeof listDealsSchema>
export type DealsStatsQuery = z.infer<typeof dealsStatsSchema>
export type OpenDealWithOrderDto = z.infer<typeof openDealWithOrderSchema>
export type CloseDealWithOrderDto = z.infer<typeof closeDealWithOrderSchema>
export type ImportTradesDto = z.infer<typeof importTradesSchema>
