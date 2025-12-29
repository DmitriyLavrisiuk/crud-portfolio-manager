import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type Cell,
  type ColumnDef,
  flexRender,
  type Header,
  type HeaderGroup,
  type Row,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { SlidersHorizontal } from 'lucide-react'
import type { CheckedState } from '@radix-ui/react-checkbox'

import { useAuth } from '@/auth/AuthProvider'
import { bulkDeleteDeals, fetchDeals, fetchDealsStats } from '@/api/dealsApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { type Deal, type DealStatus } from '@/types/deals'
import {
  formatMoneyLike,
  formatNum,
  formatPrice,
  formatQty,
} from '@/lib/format'
import { useAppTable } from '@/lib/table'
import { toastError, toastSuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'
import CreateDealDialog from '@/components/deals/CreateDealDialog'
import EditDealDialog from '@/components/deals/EditDealDialog'
import CloseDealDialog from '@/components/deals/CloseDealDialog'
import PartialCloseDealDialog from '@/components/deals/PartialCloseDealDialog'
import AddEntryLegDialog from '@/components/deals/AddEntryLegDialog'
import ProfitToPositionDialog from '@/components/deals/ProfitToPositionDialog'
import DeleteDealDialog from '@/components/deals/DeleteDealDialog'
import ImportTradesDialog from '@/components/deals/ImportTradesDialog'
import OpenWithOrderDialog from '@/components/deals/OpenWithOrderDialog'
import CloseWithOrderDialog from '@/components/deals/CloseWithOrderDialog'
import DealsRowActions from '@/components/deals/DealsRowActions'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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

type FiltersState = {
  from: Date | null
  to: Date | null
  status: 'ALL' | DealStatus
  symbol: string
}

function formatDateInput(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function formatDateLabel(date: Date) {
  return format(date, 'dd.MM.yyyy')
}

function getDefaultFilters(): FiltersState {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 30)

  return {
    from,
    to: today,
    status: 'ALL',
    symbol: '',
  }
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase()
}

export default function DealsPage() {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draftFilters, setDraftFilters] =
    useState<FiltersState>(getDefaultFilters())
  const [appliedFilters, setAppliedFilters] =
    useState<FiltersState>(getDefaultFilters())
  const [showFilters, setShowFilters] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [openWithOrderOpen, setOpenWithOrderOpen] = useState(false)
  const [editing, setEditing] = useState<Deal | null>(null)
  const [closing, setClosing] = useState<Deal | null>(null)
  const [partialClosing, setPartialClosing] = useState<Deal | null>(null)
  const [addingEntry, setAddingEntry] = useState<Deal | null>(null)
  const [profitToPosition, setProfitToPosition] = useState<Deal | null>(null)
  const [closingWithOrder, setClosingWithOrder] = useState<Deal | null>(null)
  const [deleting, setDeleting] = useState<Deal | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState<{
    deal: Deal
    phase: 'ENTRY' | 'EXIT'
  } | null>(null)

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current)
      }
    }
  }, [])

  const showNotice = useCallback((message: string) => {
    toastSuccess(message)
    setNotice(message)
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current)
    }
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null)
    }, 3000)
  }, [])

  const queryFilters = useMemo(() => {
    const symbol = normalizeSymbol(appliedFilters.symbol)
    return {
      from: appliedFilters.from
        ? formatDateInput(appliedFilters.from)
        : undefined,
      to: appliedFilters.to ? formatDateInput(appliedFilters.to) : undefined,
      status:
        appliedFilters.status === 'ALL' ? undefined : appliedFilters.status,
      symbol: symbol || undefined,
    }
  }, [appliedFilters])

  const dealsQuery = useQuery({
    queryKey: ['deals', queryFilters],
    queryFn: () =>
      fetchDeals(queryFilters, {
        accessToken,
        onUnauthorized: refresh,
      }),
  })

  const statsQuery = useQuery({
    queryKey: ['dealsStats', queryFilters],
    queryFn: () =>
      fetchDealsStats(queryFilters, {
        accessToken,
        onUnauthorized: refresh,
      }),
  })

  const data = useMemo(() => dealsQuery.data?.items ?? [], [dealsQuery.data])

  useEffect(() => {
    const dataIds = new Set(data.map((deal) => deal.id))
    setSelectedIds((prev) => {
      if (prev.size === 0) {
        return prev
      }
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (dataIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [data])

  const handleEdit = useCallback((deal: Deal) => {
    setEditing(deal)
  }, [])

  const handleClose = useCallback((deal: Deal) => {
    setClosing(deal)
  }, [])

  const handlePartialClose = useCallback((deal: Deal) => {
    setPartialClosing(deal)
  }, [])

  const handleAddEntry = useCallback((deal: Deal) => {
    setAddingEntry(deal)
  }, [])

  const handleProfitToPosition = useCallback((deal: Deal) => {
    setProfitToPosition(deal)
  }, [])

  const handleCloseWithOrder = useCallback((deal: Deal) => {
    setClosingWithOrder(deal)
  }, [])

  const handleDelete = useCallback((deal: Deal) => {
    setDeleting(deal)
  }, [])

  const handleImport = useCallback((deal: Deal, phase: 'ENTRY' | 'EXIT') => {
    setImporting({ deal, phase })
  }, [])

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) {
        throw new Error('Нет выбранных сделок')
      }
      return bulkDeleteDeals(ids, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      setSelectedIds((prev) => {
        if (result.deletedIds.length === 0) {
          return prev
        }
        const next = new Set(prev)
        for (const id of result.deletedIds) {
          next.delete(id)
        }
        return next
      })
      setBulkDeleteOpen(false)
      showNotice(`Удалено сделок: ${result.deletedCount}`)
    },
    onError: (error) => {
      if (error instanceof Error) {
        toastError(`Ошибка удаления: ${error.message}`)
        return
      }
      toastError('Ошибка удаления: неизвестная ошибка')
    },
  })

  const formatWinRate = useCallback((value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '0%'
    return `${formatNum(value, { maxFrac: 2 })}%`
  }, [])

  const getSignedClass = useCallback((value?: string | number) => {
    if (value === undefined || value === null) {
      return 'text-muted-foreground'
    }
    const numeric = Number(value)
    if (Number.isNaN(numeric)) {
      return 'text-muted-foreground'
    }
    if (numeric > 0) return 'text-emerald-600'
    if (numeric < 0) return 'text-red-600'
    return 'text-muted-foreground'
  }, [])

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        id: 'select',
        header: () => {
          const ids = data.map((deal) => deal.id)
          const allSelected =
            ids.length > 0 && ids.every((id) => selectedIds.has(id))
          const someSelected =
            ids.some((id) => selectedIds.has(id)) && !allSelected
          const checked = allSelected
            ? true
            : someSelected
              ? 'indeterminate'
              : false

          return (
            <Checkbox
              aria-label="Выбрать все сделки на странице"
              checked={checked}
              onCheckedChange={(value: CheckedState) => {
                const nextChecked = value === true
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  if (nextChecked) {
                    for (const id of ids) {
                      next.add(id)
                    }
                  } else {
                    for (const id of ids) {
                      next.delete(id)
                    }
                  }
                  return next
                })
              }}
            />
          )
        },
        cell: ({ row }: { row: Row<Deal> }) => (
          <Checkbox
            aria-label="Выбрать сделку"
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(value: CheckedState) => {
              const nextChecked = value === true
              setSelectedIds((prev) => {
                const next = new Set(prev)
                if (nextChecked) {
                  next.add(row.original.id)
                } else {
                  next.delete(row.original.id)
                }
                return next
              })
            }}
          />
        ),
        meta: {
          headerClassName: 'sticky left-0 z-30 bg-background text-xs',
          cellClassName: 'sticky left-0 z-20 bg-background',
          sizeClassName: 'w-10',
        },
      },
      {
        id: 'rowNumber',
        header: '#',
        cell: ({ row }: { row: Row<Deal> }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.index + 1}
          </span>
        ),
        meta: {
          headerClassName: 'sticky left-10 z-30 bg-background text-xs',
          cellClassName: 'sticky left-10 z-20 bg-background',
          sizeClassName: 'w-10',
        },
      },
      {
        accessorKey: 'openedAt',
        header: 'Открыта',
        cell: ({ row }: { row: Row<Deal> }) =>
          row.original.openedAt
            ? new Date(row.original.openedAt).toLocaleDateString()
            : '-',
        meta: {
          headerClassName: 'sticky left-[5rem] z-30 bg-background text-xs',
          cellClassName: 'sticky left-[5rem] z-20 bg-background',
          sizeClassName: 'w-28',
        },
      },
      {
        accessorKey: 'symbol',
        header: 'Символ',
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue()
          const label = typeof value === 'string' ? value : String(value ?? '')
          return <Badge variant="secondary">{label}</Badge>
        },
        meta: {
          headerClassName: 'sticky left-[12rem] z-30 bg-background text-xs',
          cellClassName: 'sticky left-[12rem] z-20 bg-background',
          sizeClassName: 'w-24',
        },
      },
      {
        accessorKey: 'direction',
        header: 'Направление',
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const value = getValue()
          return typeof value === 'string' ? value : String(value ?? '')
        },
      },
      {
        accessorKey: 'status',
        header: 'Статус',
        cell: ({ getValue }: { getValue: () => unknown }) =>
          getValue() === 'OPEN' ? 'ОТКРЫТА' : 'ЗАКРЫТА',
        meta: {
          headerClassName: 'sticky left-[18rem] z-30 bg-background text-xs',
          cellClassName: 'sticky left-[18rem] z-20 bg-background',
          sizeClassName: 'w-24',
        },
      },
      {
        id: 'entryQuote',
        header: 'Вход (quote)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatMoneyLike(row.original.entry?.quote),
      },
      {
        accessorKey: 'entryAvgPrice',
        header: 'Средняя цена входа',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatPrice(row.original.entryAvgPrice ?? row.original.entry?.price),
      },
      {
        accessorKey: 'closedQty',
        header: 'Закрыто (qty)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatQty(row.original.closedQty),
      },
      {
        accessorKey: 'remainingQty',
        header: 'Остаток (qty)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatQty(row.original.remainingQty),
      },
      {
        id: 'exitQuote',
        header: 'Выход (quote)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatMoneyLike(row.original.exit?.quote),
      },
      {
        accessorKey: 'realizedPnl',
        header: 'PnL',
        cell: ({ row }: { row: Row<Deal> }) => (
          <span className={getSignedClass(row.original.realizedPnl)}>
            {formatMoneyLike(row.original.realizedPnl)}
          </span>
        ),
      },
      {
        accessorKey: 'realizedPnlAvailable',
        header: 'Доступная прибыль',
        cell: ({ row }: { row: Row<Deal> }) => {
          const deal = row.original
          if (deal.realizedPnlAvailable !== undefined) {
            return (
              <span className={getSignedClass(deal.realizedPnlAvailable)}>
                {formatMoneyLike(deal.realizedPnlAvailable)}
              </span>
            )
          }
          if (deal.realizedPnl && deal.profitSpentTotal) {
            const value =
              Number(deal.realizedPnl) - Number(deal.profitSpentTotal)
            return (
              <span className={getSignedClass(value)}>
                {Number.isFinite(value) ? formatMoneyLike(value) : '-'}
              </span>
            )
          }
          return (
            <span className={getSignedClass(deal.realizedPnl)}>
              {formatMoneyLike(deal.realizedPnl)}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }: { row: Row<Deal> }) => (
          <DealsRowActions
            deal={row.original}
            onImportEntry={(deal) => handleImport(deal, 'ENTRY')}
            onImportExit={(deal) => handleImport(deal, 'EXIT')}
            onEdit={handleEdit}
            onAddEntry={handleAddEntry}
            onProfitToPosition={handleProfitToPosition}
            onPartialClose={handlePartialClose}
            onClose={handleClose}
            onCloseWithOrder={handleCloseWithOrder}
            onDelete={handleDelete}
          />
        ),
        meta: {
          headerClassName:
            'sticky right-0 z-30 bg-background text-xs text-right',
          cellClassName: 'sticky right-0 z-20 bg-background text-right',
          sizeClassName: 'w-16',
        },
      },
    ],
    [
      handleEdit,
      handleClose,
      handleAddEntry,
      handleProfitToPosition,
      handlePartialClose,
      handleCloseWithOrder,
      handleDelete,
      handleImport,
      data,
      selectedIds,
      getSignedClass,
    ],
  )

  const stats = statsQuery.data
  const statsLoading = statsQuery.isLoading
  const statsError =
    statsQuery.error instanceof Error ? statsQuery.error.message : null

  const selectedCount = selectedIds.size
  const table = useAppTable({
    data,
    columns,
  })

  const handleApply = () => {
    const nextSymbol = normalizeSymbol(draftFilters.symbol)
    const next = { ...draftFilters, symbol: nextSymbol }
    setDraftFilters(next)
    setAppliedFilters(next)
  }

  const handleReset = () => {
    const defaults = getDefaultFilters()
    setDraftFilters(defaults)
    setAppliedFilters(defaults)
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Статистика</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Общий PnL</p>
              <p className="text-lg font-semibold">
                {statsLoading
                  ? 'Загрузка...'
                  : formatMoneyLike(stats?.totalPnL ?? '0')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Сделок (закрытые)</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Загрузка...' : (stats?.tradesCount ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Процент прибыльных
              </p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Загрузка...' : formatWinRate(stats?.winRate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Средний PnL</p>
              <p className="text-lg font-semibold">
                {statsLoading
                  ? 'Загрузка...'
                  : formatMoneyLike(stats?.avgPnL ?? '0')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Комиссии</p>
              <p className="text-lg font-semibold">
                {statsLoading
                  ? 'Загрузка...'
                  : formatMoneyLike(stats?.feesTotal ?? '0')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Открытых сделок</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Загрузка...' : (stats?.openCount ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Доступная прибыль</p>
              <p className="text-lg font-semibold">
                {statsLoading
                  ? 'Загрузка...'
                  : formatMoneyLike(stats?.profitAvailable ?? '0')}
              </p>
            </div>
          </div>
          {statsError && (
            <p className="text-sm text-destructive">{statsError}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Сделки</CardTitle>
            <p className="text-sm text-muted-foreground">
              Управление сделками.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreateOpen(true)}>Создать сделку</Button>
            <Button
              variant="outline"
              onClick={() => setOpenWithOrderOpen(true)}
            >
              Открыть через ордер
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Фильтры
            </Button>
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                Удалить ({selectedCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showFilters && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[180px] flex-col gap-2">
                <Label>С</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal',
                        !draftFilters.from && 'text-muted-foreground',
                      )}
                    >
                      {draftFilters.from
                        ? formatDateLabel(draftFilters.from)
                        : 'Выберите дату'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={draftFilters.from ?? undefined}
                      onSelect={(date: Date | undefined) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          from: date ?? null,
                        }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex min-w-[180px] flex-col gap-2">
                <Label>По</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal',
                        !draftFilters.to && 'text-muted-foreground',
                      )}
                    >
                      {draftFilters.to
                        ? formatDateLabel(draftFilters.to)
                        : 'Выберите дату'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={draftFilters.to ?? undefined}
                      onSelect={(date: Date | undefined) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          to: date ?? null,
                        }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                <Label>Символ</Label>
                <Input
                  placeholder="Символ"
                  value={draftFilters.symbol}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      symbol: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div className="flex min-w-[180px] flex-col gap-2">
                <Label>Статус</Label>
                <Select
                  value={draftFilters.status}
                  onValueChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: value as FiltersState['status'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Все</SelectItem>
                    <SelectItem value="OPEN">Открытые</SelectItem>
                    <SelectItem value="CLOSED">Закрытые</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="inline-flex">
                <Button
                  variant="secondary"
                  className="rounded-r-none"
                  onClick={handleApply}
                >
                  Применить
                </Button>
                <Button
                  variant="outline"
                  className="rounded-l-none border-l-0"
                  onClick={handleReset}
                >
                  Сбросить
                </Button>
              </div>
            </div>
          )}

          {notice && (
            <p className="text-sm text-emerald-600" role="status">
              {notice}
            </p>
          )}
          {dealsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Загрузка сделок...</p>
          )}
          {dealsQuery.error instanceof Error && (
            <p className="text-sm text-destructive">
              {dealsQuery.error.message}
            </p>
          )}

          {!dealsQuery.isLoading && (
            <div className="w-full overflow-x-auto rounded-md border border-border">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  {table
                    .getHeaderGroups()
                    .map((headerGroup: HeaderGroup<Deal>) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(
                          (header: Header<Deal, unknown>) => (
                            <TableHead
                              key={header.id}
                              className={cn(
                                'px-3 py-2 text-xs font-medium text-muted-foreground',
                                header.column.columnDef.meta?.headerClassName,
                                header.column.columnDef.meta?.sizeClassName,
                              )}
                            >
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
                    table.getRowModel().rows.map((row: Row<Deal>) => (
                      <TableRow key={row.id}>
                        {row
                          .getVisibleCells()
                          .map((cell: Cell<Deal, unknown>) => (
                            <TableCell
                              key={cell.id}
                              className={cn(
                                'px-3 py-2 text-sm',
                                cell.column.columnDef.meta?.cellClassName,
                                cell.column.columnDef.meta?.sizeClassName,
                              )}
                            >
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
                        Сделки не найдены.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <CreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={showNotice}
      />
      <OpenWithOrderDialog
        open={openWithOrderOpen}
        onOpenChange={setOpenWithOrderOpen}
        onSuccess={showNotice}
        queryFilters={queryFilters}
      />
      <EditDealDialog
        deal={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => (!open ? setEditing(null) : null)}
        onSuccess={showNotice}
      />
      <CloseDealDialog
        deal={closing}
        open={Boolean(closing)}
        onOpenChange={(open) => (!open ? setClosing(null) : null)}
        onSuccess={showNotice}
      />
      <PartialCloseDealDialog
        deal={partialClosing}
        open={Boolean(partialClosing)}
        onOpenChange={(open) => (!open ? setPartialClosing(null) : null)}
        onSuccess={showNotice}
      />
      <AddEntryLegDialog
        deal={addingEntry}
        open={Boolean(addingEntry)}
        onOpenChange={(open) => (!open ? setAddingEntry(null) : null)}
        onSuccess={showNotice}
      />
      <ProfitToPositionDialog
        deal={profitToPosition}
        availableProfit={stats?.profitAvailable}
        open={Boolean(profitToPosition)}
        onOpenChange={(open) => (!open ? setProfitToPosition(null) : null)}
        onSuccess={showNotice}
      />
      {closingWithOrder && (
        <CloseWithOrderDialog
          deal={closingWithOrder}
          open={Boolean(closingWithOrder)}
          onOpenChange={(open) => (!open ? setClosingWithOrder(null) : null)}
          onSuccess={showNotice}
          queryFilters={queryFilters}
        />
      )}
      <DeleteDealDialog
        deal={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => (!open ? setDeleting(null) : null)}
        onSuccess={showNotice}
        onDeleted={(id) =>
          setSelectedIds((prev) => {
            if (!prev.has(id)) {
              return prev
            }
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      />
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сделки?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалено: {selectedCount}. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bulkDeleteMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {bulkDeleteMutation.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate()}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? 'Удаляем...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {importing && (
        <ImportTradesDialog
          open={Boolean(importing)}
          onOpenChange={(open) => (!open ? setImporting(null) : null)}
          deal={importing.deal}
          phase={importing.phase}
          onSuccess={showNotice}
        />
      )}
    </section>
  )
}
