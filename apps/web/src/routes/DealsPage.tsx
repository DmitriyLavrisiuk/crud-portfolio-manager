import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { format } from 'date-fns'

import { useAuth } from '@/auth/AuthProvider'
import { fetchDeals, fetchDealsStats } from '@/api/dealsApi'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import { type Deal, type DealStatus } from '@/types/deals'
import {
  formatMoneyLike,
  formatNum,
  formatPrice,
  formatQty,
} from '@/lib/format'
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
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draftFilters, setDraftFilters] =
    useState<FiltersState>(getDefaultFilters())
  const [appliedFilters, setAppliedFilters] =
    useState<FiltersState>(getDefaultFilters())
  const [createOpen, setCreateOpen] = useState(false)
  const [openWithOrderOpen, setOpenWithOrderOpen] = useState(false)
  const [editing, setEditing] = useState<Deal | null>(null)
  const [closing, setClosing] = useState<Deal | null>(null)
  const [partialClosing, setPartialClosing] = useState<Deal | null>(null)
  const [addingEntry, setAddingEntry] = useState<Deal | null>(null)
  const [profitToPosition, setProfitToPosition] = useState<Deal | null>(null)
  const [closingWithOrder, setClosingWithOrder] = useState<Deal | null>(null)
  const [deleting, setDeleting] = useState<Deal | null>(null)
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

  const formatWinRate = useCallback((value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '0%'
    return `${formatNum(value, { maxFrac: 2 })}%`
  }, [])

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        id: 'rowNumber',
        header: '#',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.index + 1}
          </span>
        ),
        meta: {
          headerClassName: 'sticky left-0 z-30 bg-background text-xs',
          cellClassName: 'sticky left-0 z-20 bg-background',
          sizeClassName: 'w-10',
        },
      },
      {
        accessorKey: 'openedAt',
        header: 'Открыта',
        cell: ({ row }) =>
          row.original.openedAt
            ? new Date(row.original.openedAt).toLocaleDateString()
            : '-',
        meta: {
          headerClassName: 'sticky left-10 z-30 bg-background text-xs',
          cellClassName: 'sticky left-10 z-20 bg-background',
          sizeClassName: 'w-28',
        },
      },
      {
        accessorKey: 'symbol',
        header: 'Символ',
        cell: ({ getValue }) => getValue(),
        meta: {
          headerClassName: 'sticky left-[9.5rem] z-30 bg-background text-xs',
          cellClassName: 'sticky left-[9.5rem] z-20 bg-background',
          sizeClassName: 'w-24',
        },
      },
      {
        accessorKey: 'direction',
        header: 'Направление',
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: 'status',
        header: 'Статус',
        cell: ({ getValue }) => (getValue() === 'OPEN' ? 'ОТКРЫТА' : 'ЗАКРЫТА'),
        meta: {
          headerClassName: 'sticky left-[15.5rem] z-30 bg-background text-xs',
          cellClassName: 'sticky left-[15.5rem] z-20 bg-background',
          sizeClassName: 'w-24',
        },
      },
      {
        id: 'entryQuote',
        header: 'Вход (quote)',
        cell: ({ row }) => formatMoneyLike(row.original.entry?.quote),
      },
      {
        accessorKey: 'entryAvgPrice',
        header: 'Средняя цена входа',
        cell: ({ row }) =>
          formatPrice(row.original.entryAvgPrice ?? row.original.entry?.price),
      },
      {
        accessorKey: 'closedQty',
        header: 'Закрыто (qty)',
        cell: ({ row }) => formatQty(row.original.closedQty),
      },
      {
        accessorKey: 'remainingQty',
        header: 'Остаток (qty)',
        cell: ({ row }) => formatQty(row.original.remainingQty),
      },
      {
        id: 'exitQuote',
        header: 'Выход (quote)',
        cell: ({ row }) => formatMoneyLike(row.original.exit?.quote),
      },
      {
        accessorKey: 'realizedPnl',
        header: 'PnL',
        cell: ({ row }) => formatMoneyLike(row.original.realizedPnl),
      },
      {
        accessorKey: 'realizedPnlAvailable',
        header: 'Доступная прибыль',
        cell: ({ row }) => {
          const deal = row.original
          if (deal.realizedPnlAvailable !== undefined) {
            return formatMoneyLike(deal.realizedPnlAvailable)
          }
          if (deal.realizedPnl && deal.profitSpentTotal) {
            const value =
              Number(deal.realizedPnl) - Number(deal.profitSpentTotal)
            return Number.isFinite(value) ? formatMoneyLike(value) : '-'
          }
          return formatMoneyLike(deal.realizedPnl)
        },
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }) => (
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
    ],
  )

  const stats = statsQuery.data
  const statsLoading = statsQuery.isLoading
  const statsError =
    statsQuery.error instanceof Error ? statsQuery.error.message : null

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
                    onSelect={(date) =>
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
                    onSelect={(date) =>
                      setDraftFilters((prev) => ({ ...prev, to: date ?? null }))
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
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
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
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
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
      />
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
