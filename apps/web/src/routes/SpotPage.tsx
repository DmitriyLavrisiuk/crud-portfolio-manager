import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  cancelReplaceSpotOrder,
  cancelSpotOrder,
  getSpotAccount,
  getSpotMyTrades,
  getSpotOpenOrders,
  placeSpotOrder,
  type BinanceSpotOrder,
  type BinanceSpotTrade,
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

function parseBalanceValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type BinanceFilterFailure = {
  code: 'BINANCE_FILTER_FAILURE'
  filter: 'NOTIONAL' | 'LOT_SIZE' | 'PRICE_FILTER'
  symbol: string
  message: string
  details?: {
    minNotional?: string
    notional?: string
    quoteAsset?: string
    baseAsset?: string
  }
}

type ApiErrorWithData = Error & {
  data?: BinanceFilterFailure
}

const AccountCard = memo(function AccountCard() {
  const { accessToken, refresh } = useAuth()
  const accountQuery = useQuery({
    queryKey: ['spotAccount'],
    queryFn: () => getSpotAccount({ accessToken, onUnauthorized: refresh }),
  })

  const balances = useMemo(() => {
    const items = accountQuery.data?.balances ?? []
    return items.filter(
      (balance) =>
        parseBalanceValue(balance.free) > 0 ||
        parseBalanceValue(balance.locked) > 0,
    )
  }, [accountQuery.data?.balances])

  return (
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
  )
})

const PlaceOrderCard = memo(function PlaceOrderCard() {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [orderError, setOrderError] = useState<string | null>(null)

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

  const symbolField = orderForm.register('symbol', {
    setValueAs: (value) =>
      String(value ?? '')
        .toUpperCase()
        .trim(),
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
      queryClient.invalidateQueries({ queryKey: ['spotOpenOrders'] })
      queryClient.invalidateQueries({ queryKey: ['spotMyTrades'] })
      setOrderError(null)
      orderForm.clearErrors()
    },
    onError: (error) => {
      const apiError = error as ApiErrorWithData
      if (apiError.data?.code === 'BINANCE_FILTER_FAILURE') {
        const { filter, symbol, details } = apiError.data
        if (filter === 'NOTIONAL') {
          const minNotional = details?.minNotional ?? '—'
          const notional = details?.notional ?? '—'
          const quoteAsset = details?.quoteAsset ?? ''
          const message = `Минимальная сумма сделки для ${symbol}: ${minNotional} ${quoteAsset}. У тебя: ${notional}.`
          setOrderError(message)

          const values = orderForm.getValues()
          if (
            values.type === 'MARKET' &&
            values.side === 'BUY' &&
            values.marketBuyMode === 'QUOTE'
          ) {
            orderForm.setError('quoteOrderQty', { message })
            return
          }

          if (values.type === 'LIMIT') {
            orderForm.setError('price', { message })
            return
          }

          orderForm.setError('quantity', { message })
          return
        }
      }

      setOrderError(
        error instanceof Error ? error.message : 'Failed to place order.',
      )
    },
  })

  const handleSubmit = useCallback(
    (values: SpotOrderFormValues) => {
      placeOrderMutation.mutate(values)
    },
    [placeOrderMutation],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place order</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={orderForm.handleSubmit(handleSubmit)}
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
                {(() => {
                  const field = orderForm.register('marketBuyMode')
                  return (
                    <>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="QUOTE"
                          name={field.name}
                          ref={field.ref}
                          checked={marketBuyMode === 'QUOTE'}
                          onChange={(event) => {
                            field.onChange(event)
                            orderForm.setValue('quantity', '', {
                              shouldValidate: false,
                            })
                          }}
                        />
                        Spend (quote)
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="BASE"
                          name={field.name}
                          ref={field.ref}
                          checked={marketBuyMode === 'BASE'}
                          onChange={(event) => {
                            field.onChange(event)
                            orderForm.setValue('quoteOrderQty', '', {
                              shouldValidate: false,
                            })
                          }}
                        />
                        Buy amount (base)
                      </label>
                    </>
                  )
                })()}
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
  )
})

const OpenOrdersCard = memo(function OpenOrdersCard() {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [openOrdersError, setOpenOrdersError] = useState<string | null>(null)
  const openOrdersSymbolRef = useRef<HTMLInputElement>(null)
  const [openOrdersSymbolQuery, setOpenOrdersSymbolQuery] = useState<
    string | null
  >(null)
  const [cancelTarget, setCancelTarget] = useState<BinanceSpotOrder | null>(
    null,
  )
  const [editTarget, setEditTarget] = useState<BinanceSpotOrder | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editFieldErrors, setEditFieldErrors] = useState<{
    price?: string
    quantity?: string
  }>({})

  const openOrdersQuery = useQuery({
    queryKey: ['spotOpenOrders', openOrdersSymbolQuery],
    queryFn: () => {
      if (!openOrdersSymbolQuery) {
        return Promise.resolve([])
      }
      return getSpotOpenOrders(openOrdersSymbolQuery, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    enabled: Boolean(openOrdersSymbolQuery),
  })

  const cancelMutation = useMutation({
    mutationFn: (order: BinanceSpotOrder) =>
      cancelSpotOrder(
        {
          symbol: order.symbol ?? openOrdersSymbolQuery ?? '',
          orderId: order.orderId,
        },
        { accessToken, onUnauthorized: refresh },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotAccount'] })
      queryClient.invalidateQueries({ queryKey: ['spotOpenOrders'] })
      setCancelTarget(null)
      setOpenOrdersError(null)
    },
    onError: (error) => {
      setOpenOrdersError(
        error instanceof Error ? error.message : 'Failed to cancel order.',
      )
    },
  })

  const editMutation = useMutation({
    mutationFn: (order: BinanceSpotOrder) =>
      cancelReplaceSpotOrder(
        {
          symbol: openOrdersSymbolQuery ?? order.symbol,
          cancelOrderId: order.orderId,
          cancelReplaceMode: 'STOP_ON_FAILURE',
          side: order.side,
          type: 'LIMIT',
          timeInForce: 'GTC',
          quantity: editQuantity.trim(),
          price: editPrice.trim(),
        },
        { accessToken, onUnauthorized: refresh },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotAccount'] })
      queryClient.invalidateQueries({ queryKey: ['spotOpenOrders'] })
      queryClient.invalidateQueries({ queryKey: ['spotMyTrades'] })
      setEditTarget(null)
      setEditError(null)
      setEditFieldErrors({})
    },
    onError: (error) => {
      const apiError = error as ApiErrorWithData
      if (apiError.data?.code === 'BINANCE_FILTER_FAILURE') {
        const { filter, symbol, details } = apiError.data
        if (filter === 'NOTIONAL') {
          const minNotional = details?.minNotional ?? '—'
          const notional = details?.notional ?? '—'
          const quoteAsset = details?.quoteAsset ?? ''
          const message = `Минимальная сумма сделки для ${symbol}: ${minNotional} ${quoteAsset}. У тебя: ${notional}.`
          setEditError(message)
          setEditFieldErrors({ price: message })
          return
        }
        if (filter === 'LOT_SIZE') {
          setEditError(apiError.data.message)
          setEditFieldErrors({ quantity: apiError.data.message })
          return
        }
        if (filter === 'PRICE_FILTER') {
          setEditError(apiError.data.message)
          setEditFieldErrors({ price: apiError.data.message })
          return
        }
      }

      setEditError(
        error instanceof Error ? error.message : 'Failed to edit order.',
      )
    },
  })

  const handleCancelOpen = useCallback((order: BinanceSpotOrder) => {
    setCancelTarget(order)
  }, [])

  const handleEditOpen = useCallback((order: BinanceSpotOrder) => {
    setEditTarget(order)
    setEditPrice(order.price)
    setEditQuantity(order.origQty)
    setEditError(null)
    setEditFieldErrors({})
  }, [])

  const columns = useMemo<ColumnDef<BinanceSpotOrder>[]>(
    () => [
      { accessorKey: 'orderId', header: 'Order ID' },
      { accessorKey: 'side', header: 'Side' },
      { accessorKey: 'type', header: 'Type' },
      { accessorKey: 'price', header: 'Price' },
      { accessorKey: 'origQty', header: 'Orig Qty' },
      { accessorKey: 'executedQty', header: 'Executed' },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'timeInForce', header: 'TIF' },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const order = row.original
          const canEdit =
            order.type === 'LIMIT' &&
            (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED')

          return (
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditOpen(order)}
                >
                  Edit
                </Button>
              ) : null}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleCancelOpen(order)}
              >
                Cancel
              </Button>
            </div>
          )
        },
      },
    ],
    [handleCancelOpen, handleEditOpen],
  )

  const table = useReactTable({
    data: openOrdersQuery.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleLoad = useCallback(() => {
    const nextSymbol = (openOrdersSymbolRef.current?.value ?? '')
      .trim()
      .toUpperCase()
    if (!nextSymbol) {
      setOpenOrdersError('Symbol is required.')
      return
    }
    setOpenOrdersError(null)
    if (nextSymbol === openOrdersSymbolQuery) {
      openOrdersQuery.refetch()
      return
    }
    setOpenOrdersSymbolQuery(nextSymbol)
  }, [openOrdersQuery, openOrdersSymbolQuery])

  const handleEditPriceChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setEditPrice(event.target.value)
    },
    [],
  )

  const handleEditQuantityChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setEditQuantity(event.target.value)
    },
    [],
  )

  const handleEditSubmit = useCallback(() => {
    if (!editTarget) return
    setEditError(null)
    setEditFieldErrors({})
    editMutation.mutate(editTarget)
  }, [editMutation, editTarget])

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Open orders</CardTitle>
          <Button
            variant="outline"
            onClick={handleLoad}
            disabled={openOrdersQuery.isFetching}
          >
            Load
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="spot-orders-symbol">Symbol</Label>
          <Input
            id="spot-orders-symbol"
            defaultValue="BTCUSDT"
            ref={openOrdersSymbolRef}
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

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit limit order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price</Label>
              <Input
                id="edit-price"
                value={editPrice}
                onChange={handleEditPriceChange}
              />
              {editFieldErrors.price ? (
                <p className="text-xs text-destructive">
                  {editFieldErrors.price}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Quantity</Label>
              <Input
                id="edit-quantity"
                value={editQuantity}
                onChange={handleEditQuantityChange}
              />
              {editFieldErrors.quantity ? (
                <p className="text-xs text-destructive">
                  {editFieldErrors.quantity}
                </p>
              ) : null}
            </div>
            {editError ? (
              <p className="text-sm text-destructive">{editError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editMutation.isPending}
            >
              Close
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
})

const RecentTradesCard = memo(function RecentTradesCard() {
  const { accessToken, refresh } = useAuth()
  const tradesSymbolRef = useRef<HTMLInputElement>(null)
  const [tradesSymbolQuery, setTradesSymbolQuery] = useState<string | null>(
    null,
  )

  const tradesQuery = useQuery({
    queryKey: ['spotMyTrades', tradesSymbolQuery],
    queryFn: () => {
      if (!tradesSymbolQuery) {
        return Promise.resolve([])
      }
      return getSpotMyTrades(
        { symbol: tradesSymbolQuery, limit: 100 },
        { accessToken, onUnauthorized: refresh },
      )
    },
    enabled: Boolean(tradesSymbolQuery),
  })

  const columns = useMemo<ColumnDef<BinanceSpotTrade>[]>(
    () => [
      {
        accessorKey: 'time',
        header: 'Time',
        cell: ({ row }) => new Date(row.original.time).toLocaleString(),
      },
      {
        id: 'side',
        header: 'Side',
        cell: ({ row }) => (row.original.isBuyer ? 'BUY' : 'SELL'),
      },
      { accessorKey: 'price', header: 'Price' },
      { accessorKey: 'qty', header: 'Qty' },
      { accessorKey: 'quoteQty', header: 'Quote Qty' },
      {
        id: 'commission',
        header: 'Commission',
        cell: ({ row }) =>
          `${row.original.commission} ${row.original.commissionAsset}`,
      },
    ],
    [],
  )

  const table = useReactTable({
    data: tradesQuery.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleLoad = useCallback(() => {
    const nextSymbol = (tradesSymbolRef.current?.value ?? '')
      .trim()
      .toUpperCase()
    if (!nextSymbol) {
      return
    }
    if (nextSymbol === tradesSymbolQuery) {
      tradesQuery.refetch()
      return
    }
    setTradesSymbolQuery(nextSymbol)
  }, [tradesQuery, tradesSymbolQuery])

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Recent trades</CardTitle>
          <Button
            variant="outline"
            onClick={handleLoad}
            disabled={tradesQuery.isFetching}
          >
            Load
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="spot-trades-symbol">Symbol</Label>
          <Input
            id="spot-trades-symbol"
            defaultValue="BTCUSDT"
            ref={tradesSymbolRef}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tradesQuery.isFetching ? (
          <p className="text-sm text-muted-foreground">Loading trades...</p>
        ) : tradesQuery.data && tradesQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trades found.</p>
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
                      Load trades to see results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {tradesQuery.error instanceof Error ? (
          <p className="text-sm text-destructive">
            {tradesQuery.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
})

export default function SpotPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Spot trading</h1>
        <p className="text-muted-foreground">
          Testnet balances and orders via Binance Spot API.
        </p>
      </div>

      <AccountCard />
      <PlaceOrderCard />
      <RecentTradesCard />
      <OpenOrdersCard />
    </section>
  )
}
