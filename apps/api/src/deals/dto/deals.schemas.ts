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

export type CreateDealDto = z.infer<typeof createDealSchema>
export type UpdateDealDto = z.infer<typeof updateDealSchema>
export type CloseDealDto = z.infer<typeof closeDealSchema>
export type ListDealsQuery = z.infer<typeof listDealsSchema>
export type DealsStatsQuery = z.infer<typeof dealsStatsSchema>
