import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  value === '' || value === null ? undefined : value

const decimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Value must be a decimal string')

const positiveDecimalStringSchema = decimalStringSchema.refine(
  (value) => Number(value) > 0,
  'Value must be greater than 0',
)

const nonNegativeDecimalStringSchema = decimalStringSchema.refine(
  (value) => Number(value) >= 0,
  'Value must be non-negative',
)

const dateStringSchema = z
  .string()
  .min(1, 'Date is required')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date')

const symbolSchema = z
  .string()
  .trim()
  .min(3, 'Symbol must be at least 3 characters')
  .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase')

const entrySchema = z.object({
  qty: positiveDecimalStringSchema,
  price: positiveDecimalStringSchema,
  fee: z.preprocess(
    emptyToUndefined,
    nonNegativeDecimalStringSchema.optional(),
  ),
  feeAsset: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
})

const exitSchema = z.object({
  qty: positiveDecimalStringSchema,
  price: positiveDecimalStringSchema,
  fee: z.preprocess(
    emptyToUndefined,
    nonNegativeDecimalStringSchema.optional(),
  ),
  feeAsset: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
})

export const createDealSchema = z.object({
  symbol: symbolSchema,
  direction: z.enum(['LONG', 'SHORT']),
  openedAt: dateStringSchema,
  entry: entrySchema,
  note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
})

export const editDealSchema = z.object({
  symbol: symbolSchema,
  direction: z.enum(['LONG', 'SHORT']),
  openedAt: dateStringSchema,
  entry: entrySchema,
  note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
})

export const closeDealSchema = z.object({
  closedAt: dateStringSchema,
  exit: exitSchema,
})

export type CreateDealFormValues = z.infer<typeof createDealSchema>
export type EditDealFormValues = z.infer<typeof editDealSchema>
export type CloseDealFormValues = z.infer<typeof closeDealSchema>
