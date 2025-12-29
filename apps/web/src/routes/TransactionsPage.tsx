import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ColumnDef,
  type Cell,
  flexRender,
  type Header,
  type HeaderGroup,
  type Row,
} from '@tanstack/react-table'

import { useAuth } from '@/auth/AuthProvider'
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type Transaction,
  type TransactionType,
} from '@/lib/transactions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAppTable } from '@/lib/table'

const emptyToUndefined = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return undefined
  }
  return value
}

const transactionFormSchema = z.object({
  type: z.enum(['BUY', 'SELL']),
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase'),
  quantity: z.coerce.number().positive(),
  price: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative().optional(),
  ),
  fee: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative().optional(),
  ),
  feeAsset: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  occurredAt: z
    .string()
    .min(1, 'Date is required')
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      'Invalid date',
    ),
  exchange: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
})

type TransactionFormValues = z.infer<typeof transactionFormSchema>

type FiltersState = {
  from: string
  to: string
  symbol: string
  type: 'ALL' | TransactionType
}

const defaultFilters: FiltersState = {
  from: '',
  to: '',
  symbol: '',
  type: 'ALL',
}

const defaultFormValues: TransactionFormValues = {
  type: 'BUY',
  symbol: '',
  quantity: 0,
  price: undefined,
  fee: undefined,
  feeAsset: undefined,
  occurredAt: '',
  exchange: 'binance',
  note: '',
}

function formatDateInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatNumber(value?: number) {
  if (value === undefined || value === null) return '—'
  return Number.isFinite(value) ? value.toString() : '—'
}

function buildPayload(values: TransactionFormValues) {
  return {
    type: values.type,
    symbol: values.symbol.trim().toUpperCase(),
    quantity: values.quantity,
    price: values.price,
    fee: values.fee,
    feeAsset: values.feeAsset?.trim() || undefined,
    occurredAt: new Date(values.occurredAt).toISOString(),
    exchange: values.exchange?.trim() || undefined,
    note: values.note?.trim() || undefined,
  }
}

export default function TransactionsPage() {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<FiltersState>(defaultFilters)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  useEffect(() => {
    setPage(1)
  }, [filters.from, filters.to, filters.symbol, filters.type])

  const queryFilters = useMemo(
    () => ({
      from: filters.from || undefined,
      to: filters.to || undefined,
      symbol: filters.symbol ? filters.symbol.trim().toUpperCase() : undefined,
      type: filters.type === 'ALL' ? undefined : filters.type,
      page,
      limit,
    }),
    [filters.from, filters.to, filters.symbol, filters.type, page, limit],
  )

  const transactionsQuery = useQuery({
    queryKey: ['transactions', queryFilters],
    queryFn: () =>
      listTransactions(queryFilters, {
        accessToken,
        onUnauthorized: refresh,
      }),
  })

  const addForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaultFormValues,
  })

  const editForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaultFormValues,
  })

  useEffect(() => {
    if (!editing) return
    editForm.reset({
      type: editing.type,
      symbol: editing.symbol,
      quantity: editing.quantity,
      price: editing.price,
      fee: editing.fee,
      feeAsset: editing.feeAsset,
      occurredAt: formatDateInput(editing.occurredAt),
      exchange: editing.exchange ?? 'binance',
      note: editing.note ?? '',
    })
  }, [editing, editForm])

  const createMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) =>
      createTransaction(buildPayload(values), {
        accessToken,
        onUnauthorized: refresh,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setIsAddOpen(false)
      addForm.reset(defaultFormValues)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      if (!editing) {
        throw new Error('No transaction selected')
      }
      return updateTransaction(editing.id, buildPayload(values), {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) {
        throw new Error('No transaction selected')
      }
      return deleteTransaction(deleteTarget.id, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setDeleteTarget(null)
    },
  })

  const items = transactionsQuery.data?.items ?? []
  const total = transactionsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: 'occurredAt',
        header: 'Date',
        cell: ({ row }: { row: Row<Transaction> }) =>
          row.original.occurredAt
            ? new Date(row.original.occurredAt).toLocaleDateString()
            : '—',
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue()
          return typeof value === 'string' ? value : String(value ?? '')
        },
      },
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue()
          return typeof value === 'string' ? value : String(value ?? '')
        },
      },
      {
        accessorKey: 'quantity',
        header: 'Quantity',
        cell: ({ row }: { row: Row<Transaction> }) =>
          formatNumber(row.original.quantity),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }: { row: Row<Transaction> }) =>
          formatNumber(row.original.price),
      },
      {
        accessorKey: 'fee',
        header: 'Fee',
        cell: ({ row }: { row: Row<Transaction> }) =>
          formatNumber(row.original.fee),
      },
      {
        accessorKey: 'note',
        header: 'Note',
        cell: ({ row }: { row: Row<Transaction> }) => row.original.note || '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: Row<Transaction> }) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(row.original)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteTarget(row.original)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  const table = useAppTable({
    data: items,
    columns,
  })

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track buys and sells locally.
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>Add Transaction</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <Input
              type="date"
              value={filters.from}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />
            <Input
              placeholder="Symbol"
              value={filters.symbol}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, symbol: event.target.value }))
              }
            />
            <Select
              value={filters.type}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  type: value as FiltersState['type'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(event) => {
                const next = Number(event.target.value)
                setLimit(
                  Number.isNaN(next) ? 20 : Math.min(Math.max(next, 1), 100),
                )
              }}
            />
          </div>

          {transactionsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading transactions...
            </p>
          )}
          {transactionsQuery.error instanceof Error && (
            <p className="text-sm text-destructive">
              {transactionsQuery.error.message}
            </p>
          )}

          {!transactionsQuery.isLoading && (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  {table
                    .getHeaderGroups()
                    .map((headerGroup: HeaderGroup<Transaction>) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(
                          (header: Header<Transaction, unknown>) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </TableHead>
                          ),
                        )}
                      </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row: Row<Transaction>) => (
                      <TableRow key={row.id}>
                        {row
                          .getVisibleCells()
                          .map((cell: Cell<Transaction, unknown>) => (
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
                      <TableCell colSpan={columns.length}>
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} • {total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>Record a local trade.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={addForm.handleSubmit((values) =>
              createMutation.mutate(values),
            )}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-type">
                  Type
                </label>
                <Select
                  value={addForm.watch('type')}
                  onValueChange={(value) =>
                    addForm.setValue('type', value as TransactionType)
                  }
                >
                  <SelectTrigger id="add-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-symbol">
                  Symbol
                </label>
                <Input id="add-symbol" {...addForm.register('symbol')} />
                {addForm.formState.errors.symbol && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.symbol.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-quantity">
                  Quantity
                </label>
                <Input
                  id="add-quantity"
                  type="number"
                  step="any"
                  {...addForm.register('quantity', { valueAsNumber: true })}
                />
                {addForm.formState.errors.quantity && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.quantity.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-price">
                  Price
                </label>
                <Input
                  id="add-price"
                  type="number"
                  step="any"
                  {...addForm.register('price', { valueAsNumber: true })}
                />
                {addForm.formState.errors.price && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.price.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-fee">
                  Fee
                </label>
                <Input
                  id="add-fee"
                  type="number"
                  step="any"
                  {...addForm.register('fee', { valueAsNumber: true })}
                />
                {addForm.formState.errors.fee && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.fee.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-fee-asset">
                  Fee Asset
                </label>
                <Input id="add-fee-asset" {...addForm.register('feeAsset')} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-date">
                  Date
                </label>
                <Input
                  id="add-date"
                  type="date"
                  {...addForm.register('occurredAt')}
                />
                {addForm.formState.errors.occurredAt && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.occurredAt.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="add-exchange">
                  Exchange
                </label>
                <Input id="add-exchange" {...addForm.register('exchange')} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="add-note">
                  Note
                </label>
                <Input id="add-note" {...addForm.register('note')} />
                {addForm.formState.errors.note && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.note.message}
                  </p>
                )}
              </div>
            </div>
            {createMutation.error instanceof Error && (
              <p className="text-sm text-destructive">
                {createMutation.error.message}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => (!open ? setEditing(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the transaction details.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit((values) =>
              updateMutation.mutate(values),
            )}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-type">
                  Type
                </label>
                <Select
                  value={editForm.watch('type')}
                  onValueChange={(value) =>
                    editForm.setValue('type', value as TransactionType)
                  }
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-symbol">
                  Symbol
                </label>
                <Input id="edit-symbol" {...editForm.register('symbol')} />
                {editForm.formState.errors.symbol && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.symbol.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-quantity">
                  Quantity
                </label>
                <Input
                  id="edit-quantity"
                  type="number"
                  step="any"
                  {...editForm.register('quantity', { valueAsNumber: true })}
                />
                {editForm.formState.errors.quantity && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.quantity.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-price">
                  Price
                </label>
                <Input
                  id="edit-price"
                  type="number"
                  step="any"
                  {...editForm.register('price', { valueAsNumber: true })}
                />
                {editForm.formState.errors.price && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.price.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-fee">
                  Fee
                </label>
                <Input
                  id="edit-fee"
                  type="number"
                  step="any"
                  {...editForm.register('fee', { valueAsNumber: true })}
                />
                {editForm.formState.errors.fee && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.fee.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-fee-asset">
                  Fee Asset
                </label>
                <Input id="edit-fee-asset" {...editForm.register('feeAsset')} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-date">
                  Date
                </label>
                <Input
                  id="edit-date"
                  type="date"
                  {...editForm.register('occurredAt')}
                />
                {editForm.formState.errors.occurredAt && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.occurredAt.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-exchange">
                  Exchange
                </label>
                <Input id="edit-exchange" {...editForm.register('exchange')} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="edit-note">
                  Note
                </label>
                <Input id="edit-note" {...editForm.register('note')} />
                {editForm.formState.errors.note && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.note.message}
                  </p>
                )}
              </div>
            </div>
            {updateMutation.error instanceof Error && (
              <p className="text-sm text-destructive">
                {updateMutation.error.message}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {deleteMutation.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
