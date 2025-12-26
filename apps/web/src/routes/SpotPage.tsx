import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  cancelSpotOrder,
  getSpotAccount,
  getSpotOpenOrders,
  placeSpotOrder,
  type BinanceSpotOrder,
} from '@/lib/binance'

const emptyToUndefined = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  return value
}

const decimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Enter a decimal value')
  .refine((value) => Number(value) > 0, 'Value must be greater than 0')

const optionalDecimalSchema = z.preprocess(
  emptyToUndefined,
  decimalStringSchema.optional(),
)

const spotOrderSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .min(6, 'Symbol must be at least 6 characters')
      .max(20, 'Symbol must be at most 20 characters')
      .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase'),
    side: z.enum(['BUY', 'SELL']),
    type: z.enum(['MARKET', 'LIMIT']),
    quantity: optionalDecimalSchema,
    quoteOrderQty: optionalDecimalSchema,
    price: optionalDecimalSchema,
    timeInForce: z.literal('GTC').optional(),
    marketBuyMode: z.enum(['QUOTE', 'BASE']).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'LIMIT') {
      if (!values.quantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity is required for LIMIT orders',
          path: ['quantity'],
        })
      }
      if (!values.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price is required for LIMIT orders',
          path: ['price'],
        })
      }
    }

    if (values.type === 'MARKET') {
      if (values.side === 'BUY') {
        const mode = values.marketBuyMode ?? 'QUOTE'
        const hasQuantity = Boolean(values.quantity)
        const hasQuote = Boolean(values.quoteOrderQty)
        if (mode === 'QUOTE' && !hasQuote) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Spend amount is required for MARKET BUY',
            path: ['quoteOrderQty'],
          })
        }
        if (mode === 'BASE' && !hasQuantity) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Quantity is required for MARKET BUY',
            path: ['quantity'],
          })
        }
        if (
          (mode === 'QUOTE' && hasQuantity) ||
          (mode === 'BASE' && hasQuote)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Use only one amount for MARKET BUY',
            path: ['quantity'],
          })
        }
      }

      if (values.side === 'SELL' && !values.quantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity is required for MARKET SELL',
          path: ['quantity'],
        })
      }
      if (values.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price is not allowed for MARKET orders',
          path: ['price'],
        })
      }
    }
  })

type SpotOrderFormValues = z.infer<typeof spotOrderSchema>

const defaultOrderValues: SpotOrderFormValues = {
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'MARKET',
  quantity: '',
  quoteOrderQty: '',
  price: '',
  timeInForce: 'GTC',
  marketBuyMode: 'QUOTE',
}

const columns: ColumnDef<BinanceSpotOrder>[] = [
  { accessorKey: 'orderId', header: 'Order ID' },
  { accessorKey: 'side', header: 'Side' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'price', header: 'Price' },
  { accessorKey: 'origQty', header: 'Orig Qty' },
  { accessorKey: 'executedQty', header: 'Executed' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'timeInForce', header: 'TIF' },
]

function parseBalanceValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function SpotPage() {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [orderError, setOrderError] = useState<string | null>(null)
  const [openOrdersError, setOpenOrdersError] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<BinanceSpotOrder | null>(
    null,
  )

  const accountQuery = useQuery({
    queryKey: ['spotAccount'],
    queryFn: () => getSpotAccount({ accessToken, onUnauthorized: refresh }),
  })

  const orderForm = useForm<SpotOrderFormValues>({
    resolver: zodResolver(spotOrderSchema),
    defaultValues: defaultOrderValues,
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  })

  const orderType = useWatch({ control: orderForm.control, name: 'type' })
  const orderSide = useWatch({ control: orderForm.control, name: 'side' })
  const marketBuyMode =
    useWatch({ control: orderForm.control, name: 'marketBuyMode' }) ?? 'QUOTE'
  const symbolValue = useWatch({ control: orderForm.control, name: 'symbol' })
  const normalizedSymbol = String(symbolValue ?? '')
    .trim()
    .toUpperCase()
  const symbolField = orderForm.register('symbol', {
    setValueAs: (value) =>
      String(value ?? '')
        .toUpperCase()
        .trim(),
  })

  const openOrdersQuery = useQuery({
    queryKey: ['spotOpenOrders', normalizedSymbol],
    queryFn: () =>
      getSpotOpenOrders(normalizedSymbol, {
        accessToken,
        onUnauthorized: refresh,
      }),
    enabled: false,
  })

  const placeOrderMutation = useMutation({
    mutationFn: (values: SpotOrderFormValues) =>
      placeSpotOrder(
        {
          symbol: values.symbol.trim().toUpperCase(),
          side: values.side,
          type: values.type,
          quantity:
            values.type === 'MARKET' && values.side === 'BUY'
              ? values.marketBuyMode === 'BASE'
                ? values.quantity?.trim() || undefined
                : undefined
              : values.quantity?.trim() || undefined,
          quoteOrderQty:
            values.type === 'MARKET' && values.side === 'BUY'
              ? values.marketBuyMode === 'QUOTE'
                ? values.quoteOrderQty?.trim() || undefined
                : undefined
              : undefined,
          price: values.type === 'LIMIT' ? values.price?.trim() : undefined,
          timeInForce: values.type === 'LIMIT' ? 'GTC' : undefined,
        },
        { accessToken, onUnauthorized: refresh },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotAccount'] })
      queryClient.invalidateQueries({
        queryKey: ['spotOpenOrders', normalizedSymbol],
      })
      setOrderError(null)
    },
    onError: (error) => {
      setOrderError(
        error instanceof Error ? error.message : 'Failed to place order.',
      )
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (order: BinanceSpotOrder) =>
      cancelSpotOrder(
        { symbol: normalizedSymbol, orderId: order.orderId },
        { accessToken, onUnauthorized: refresh },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotAccount'] })
      queryClient.invalidateQueries({
        queryKey: ['spotOpenOrders', normalizedSymbol],
      })
      setCancelTarget(null)
      setOpenOrdersError(null)
    },
    onError: (error) => {
      setOpenOrdersError(
        error instanceof Error ? error.message : 'Failed to cancel order.',
      )
    },
  })

  const balances = useMemo(() => {
    const items = accountQuery.data?.balances ?? []
    return items.filter(
      (balance) =>
        parseBalanceValue(balance.free) > 0 ||
        parseBalanceValue(balance.locked) > 0,
    )
  }, [accountQuery.data?.balances])

  const table = useReactTable({
    data: openOrdersQuery.data ?? [],
    columns: [
      ...columns,
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setCancelTarget(row.original)}
          >
            Cancel
          </Button>
        ),
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Spot trading</h1>
        <p className="text-muted-foreground">
          Testnet balances and orders via Binance Spot API.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Account balances</CardTitle>
          <Button
            variant="outline"
            onClick={() => accountQuery.refetch()}
            disabled={accountQuery.isFetching}
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {accountQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading balances...</p>
          ) : accountQuery.error instanceof Error ? (
            <p className="text-sm text-destructive">
              {accountQuery.error.message}
            </p>
          ) : balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No balances with available funds.
            </p>
          ) : (
            <div className="grid gap-2 text-sm">
              {balances.map((balance) => (
                <div
                  key={balance.asset}
                  className="flex flex-wrap items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span className="font-medium">{balance.asset}</span>
                  <span className="text-muted-foreground">
                    Free {balance.free} · Locked {balance.locked}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Place order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={orderForm.handleSubmit((values) =>
              placeOrderMutation.mutate(values),
            )}
          >
            <div className="space-y-2">
              <Label htmlFor="spot-symbol">Symbol</Label>
              <Input id="spot-symbol" {...symbolField} />
              {orderForm.formState.errors.symbol ? (
                <p className="text-xs text-destructive">
                  {orderForm.formState.errors.symbol.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Side</Label>
              <Controller
                name="side"
                control={orderForm.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select side" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Controller
                name="type"
                control={orderForm.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKET">MARKET</SelectItem>
                      <SelectItem value="LIMIT">LIMIT</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {orderType === 'MARKET' && orderSide === 'BUY' ? (
              <div className="space-y-3 md:col-span-2">
                <div className="flex flex-wrap items-center gap-4">
                  <Label>Market buy mode</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="QUOTE"
                      {...orderForm.register('marketBuyMode')}
                      checked={marketBuyMode === 'QUOTE'}
                      onChange={() => {
                        orderForm.setValue('marketBuyMode', 'QUOTE')
                        orderForm.setValue('quantity', '')
                      }}
                    />
                    Spend (quote)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="BASE"
                      {...orderForm.register('marketBuyMode')}
                      checked={marketBuyMode === 'BASE'}
                      onChange={() => {
                        orderForm.setValue('marketBuyMode', 'BASE')
                        orderForm.setValue('quoteOrderQty', '')
                      }}
                    />
                    Buy amount (base)
                  </label>
                </div>

                {marketBuyMode === 'QUOTE' ? (
                  <div className="space-y-2">
                    <Label htmlFor="spot-quote-qty">Spend (quote)</Label>
                    <Input
                      id="spot-quote-qty"
                      {...orderForm.register('quoteOrderQty')}
                      placeholder="100"
                    />
                    {orderForm.formState.errors.quoteOrderQty ? (
                      <p className="text-xs text-destructive">
                        {orderForm.formState.errors.quoteOrderQty.message}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="spot-quantity">Quantity</Label>
                    <Input
                      id="spot-quantity"
                      {...orderForm.register('quantity')}
                      placeholder="0.01"
                    />
                    {orderForm.formState.errors.quantity ? (
                      <p className="text-xs text-destructive">
                        {orderForm.formState.errors.quantity.message}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="spot-quantity">Quantity</Label>
                <Input
                  id="spot-quantity"
                  {...orderForm.register('quantity')}
                  placeholder="0.01"
                />
                {orderForm.formState.errors.quantity ? (
                  <p className="text-xs text-destructive">
                    {orderForm.formState.errors.quantity.message}
                  </p>
                ) : null}
              </div>
            )}

            {orderType === 'LIMIT' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="spot-price">Price</Label>
                  <Input
                    id="spot-price"
                    {...orderForm.register('price')}
                    placeholder="10000"
                  />
                  {orderForm.formState.errors.price ? (
                    <p className="text-xs text-destructive">
                      {orderForm.formState.errors.price.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spot-tif">Time in force</Label>
                  <Input id="spot-tif" value="GTC" disabled />
                </div>
              </>
            ) : null}

            <div className="md:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={placeOrderMutation.isPending}>
                Place order
              </Button>
              {placeOrderMutation.isPending ? (
                <span className="text-xs text-muted-foreground">
                  Sending order...
                </span>
              ) : null}
            </div>
          </form>

          {orderError ? (
            <p className="text-sm text-destructive">{orderError}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Open orders</CardTitle>
            <Button
              variant="outline"
              onClick={() => {
                if (!normalizedSymbol) {
                  setOpenOrdersError('Symbol is required.')
                  return
                }
                setOpenOrdersError(null)
                openOrdersQuery.refetch()
              }}
              disabled={openOrdersQuery.isFetching}
            >
              Load
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="spot-orders-symbol">Symbol</Label>
            <Input
              id="spot-orders-symbol"
              value={normalizedSymbol}
              onChange={(event) => {
                orderForm.setValue(
                  'symbol',
                  event.target.value.toUpperCase().trim(),
                  {
                    shouldValidate: false,
                    shouldDirty: true,
                  },
                )
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {openOrdersQuery.isFetching ? (
            <p className="text-sm text-muted-foreground">
              Loading open orders...
            </p>
          ) : openOrdersQuery.data && openOrdersQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open orders.</p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((group) => (
                    <TableRow key={group.id}>
                      {group.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={table.getAllColumns().length}
                        className="text-center text-sm text-muted-foreground"
                      >
                        Load open orders to see results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {openOrdersError ? (
            <p className="text-sm text-destructive">{openOrdersError}</p>
          ) : null}
          {openOrdersQuery.error instanceof Error ? (
            <p className="text-sm text-destructive">
              {openOrdersQuery.error.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the selected order on Binance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Keep
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelTarget) {
                  cancelMutation.mutate(cancelTarget)
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Canceling...' : 'Cancel order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
