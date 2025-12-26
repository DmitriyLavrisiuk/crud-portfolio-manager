import { z } from 'zod'

export const binanceCredentialsSchema = z.object({
  apiKey: z.string().min(10),
  apiSecret: z.string().min(10),
})

export type BinanceCredentialsDto = z.infer<typeof binanceCredentialsSchema>

const symbolSchema = z
  .string()
  .trim()
  .min(6, 'Symbol must be at least 6 characters')
  .max(20, 'Symbol must be at most 20 characters')
  .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase')

const decimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Value must be a decimal string')
  .refine((value) => Number(value) > 0, 'Value must be greater than 0')

const orderIdSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))

export const binanceSpotOpenOrdersSchema = z.object({
  symbol: symbolSchema,
})

export const binanceSpotQueryOrderSchema = z
  .object({
    symbol: symbolSchema,
    orderId: orderIdSchema.optional(),
    origClientOrderId: z.string().trim().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.orderId && !values.origClientOrderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'orderId or origClientOrderId is required',
        path: ['orderId'],
      })
    }
  })

export const binanceSpotCancelOrderSchema = binanceSpotQueryOrderSchema

export const binanceSpotPlaceOrderSchema = z
  .object({
    symbol: symbolSchema,
    side: z.enum(['BUY', 'SELL']),
    type: z.enum(['MARKET', 'LIMIT']),
    quantity: decimalStringSchema.optional(),
    quoteOrderQty: decimalStringSchema.optional(),
    price: decimalStringSchema.optional(),
    timeInForce: z.literal('GTC').optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'LIMIT') {
      if (!values.quantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'quantity is required for LIMIT orders',
          path: ['quantity'],
        })
      }
      if (!values.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'price is required for LIMIT orders',
          path: ['price'],
        })
      }
      if (!values.timeInForce) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'timeInForce is required for LIMIT orders',
          path: ['timeInForce'],
        })
      }
      if (values.quoteOrderQty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'quoteOrderQty is not allowed for LIMIT orders',
          path: ['quoteOrderQty'],
        })
      }
    }

    if (values.type === 'MARKET') {
      const hasQuantity = Boolean(values.quantity)
      const hasQuote = Boolean(values.quoteOrderQty)

      if (values.side === 'BUY') {
        if (hasQuantity === hasQuote) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Provide either quantity or quoteOrderQty for MARKET BUY',
            path: ['quantity'],
          })
        }
      }

      if (values.side === 'SELL') {
        if (!hasQuantity) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'quantity is required for MARKET SELL',
            path: ['quantity'],
          })
        }
        if (hasQuote) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'quoteOrderQty is not allowed for MARKET SELL',
            path: ['quoteOrderQty'],
          })
        }
      }

      if (values.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'price is not allowed for MARKET orders',
          path: ['price'],
        })
      }
      if (values.timeInForce) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'timeInForce is not allowed for MARKET orders',
          path: ['timeInForce'],
        })
      }
    }
  })

export type BinanceSpotOpenOrdersQuery = z.infer<
  typeof binanceSpotOpenOrdersSchema
>
export type BinanceSpotQueryOrderQuery = z.infer<
  typeof binanceSpotQueryOrderSchema
>
export type BinanceSpotCancelOrderDto = z.infer<
  typeof binanceSpotCancelOrderSchema
>
export type BinanceSpotPlaceOrderDto = z.infer<
  typeof binanceSpotPlaceOrderSchema
>
