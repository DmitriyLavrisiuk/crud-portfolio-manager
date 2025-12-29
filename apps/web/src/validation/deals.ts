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

export const partialCloseDealSchema = z.object({
  closedAt: dateStringSchema,
  exit: exitSchema,
  note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
})

export const addEntryLegSchema = z.object({
  openedAt: dateStringSchema,
  entry: entrySchema,
  note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
})

export const profitToPositionSchema = z.object({
  amount: positiveDecimalStringSchema,
  price: positiveDecimalStringSchema,
  at: dateStringSchema,
  note: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
})

export const openWithOrderSchema = z
  .object({
    symbol: symbolSchema,
    direction: z.enum(['LONG', 'SHORT']),
    marketBuyMode: z.enum(['QUOTE', 'BASE']).optional(),
    quoteOrderQty: z.preprocess(
      emptyToUndefined,
      positiveDecimalStringSchema.optional(),
    ),
    quantity: z.preprocess(
      emptyToUndefined,
      positiveDecimalStringSchema.optional(),
    ),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  })
  .superRefine((values, ctx) => {
    const isBuy = values.direction === 'LONG'
    if (isBuy) {
      if (values.marketBuyMode === 'QUOTE') {
        if (!values.quoteOrderQty) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Quote amount is required',
            path: ['quoteOrderQty'],
          })
        }
        return
      }
      if (!values.quantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity is required',
          path: ['quantity'],
        })
      }
      return
    }

    if (!values.quantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Quantity is required',
        path: ['quantity'],
      })
    }
  })

export const closeWithOrderSchema = z
  .object({
    closeSide: z.enum(['BUY', 'SELL']),
    marketBuyMode: z.enum(['QUOTE', 'BASE']).optional(),
    quoteOrderQty: z.preprocess(
      emptyToUndefined,
      positiveDecimalStringSchema.optional(),
    ),
    quantity: z.preprocess(
      emptyToUndefined,
      positiveDecimalStringSchema.optional(),
    ),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  })
  .superRefine((values, ctx) => {
    if (values.closeSide === 'SELL') {
      if (!values.quantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity is required',
          path: ['quantity'],
        })
      }
      return
    }

    if (values.marketBuyMode === 'QUOTE') {
      if (!values.quoteOrderQty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quote amount is required',
          path: ['quoteOrderQty'],
        })
      }
      return
    }

    if (!values.quantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Quantity is required',
        path: ['quantity'],
      })
    }
  })

export type CreateDealFormValues = z.infer<typeof createDealSchema>
export type EditDealFormValues = z.infer<typeof editDealSchema>
export type CloseDealFormValues = z.infer<typeof closeDealSchema>
export type PartialCloseDealFormValues = z.infer<typeof partialCloseDealSchema>
export type AddEntryLegFormValues = z.infer<typeof addEntryLegSchema>
export type ProfitToPositionFormValues = z.infer<typeof profitToPositionSchema>
export type OpenWithOrderFormValues = z.infer<typeof openWithOrderSchema>
export type CloseWithOrderFormValues = z.infer<typeof closeWithOrderSchema>
