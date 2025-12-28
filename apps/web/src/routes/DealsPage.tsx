import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { useAuth } from '@/auth/AuthProvider'
import { fetchDeals, fetchDealsStats } from '@/api/dealsApi'
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
import { type Deal, type DealStatus } from '@/types/deals'
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

type FiltersState = {
  from: string
  to: string
  status: 'ALL' | DealStatus
  symbol: string
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getDefaultFilters(): FiltersState {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 30)

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
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
      from: appliedFilters.from || undefined,
      to: appliedFilters.to || undefined,
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
    if (value === undefined || Number.isNaN(value)) return '0.00%'
    return `${value.toFixed(2)}%`
  }, [])

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        accessorKey: 'openedAt',
        header: 'Opened',
        cell: ({ row }) =>
          row.original.openedAt
            ? new Date(row.original.openedAt).toLocaleDateString()
            : '-',
      },
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: 'direction',
        header: 'Direction',
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => getValue(),
      },
      {
        id: 'entryQuote',
        header: 'Entry Quote',
        cell: ({ row }) => row.original.entry?.quote ?? '-',
      },
      {
        accessorKey: 'entryAvgPrice',
        header: 'Entry Avg',
        cell: ({ row }) =>
          row.original.entryAvgPrice ?? row.original.entry?.price ?? '-',
      },
      {
        accessorKey: 'closedQty',
        header: 'Closed Qty',
        cell: ({ row }) => row.original.closedQty ?? '-',
      },
      {
        accessorKey: 'remainingQty',
        header: 'Remaining Qty',
        cell: ({ row }) => row.original.remainingQty ?? '-',
      },
      {
        id: 'exitQuote',
        header: 'Exit Quote',
        cell: ({ row }) => row.original.exit?.quote ?? '-',
      },
      {
        accessorKey: 'realizedPnl',
        header: 'PnL',
        cell: ({ row }) => row.original.realizedPnl ?? '-',
      },
      {
        accessorKey: 'realizedPnlAvailable',
        header: 'Avail PnL',
        cell: ({ row }) => {
          const deal = row.original
          if (deal.realizedPnlAvailable !== undefined) {
            return deal.realizedPnlAvailable
          }
          if (deal.realizedPnl && deal.profitSpentTotal) {
            const value =
              Number(deal.realizedPnl) - Number(deal.profitSpentTotal)
            return Number.isFinite(value) ? value.toString() : '-'
          }
          return deal.realizedPnl ?? '-'
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleImport(row.original, 'ENTRY')}
            >
              Import entry
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleImport(row.original, 'EXIT')}
            >
              Import exit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleEdit(row.original)}
            >
              Edit
            </Button>
            {row.original.status === 'OPEN' && (
              <>
                <Button size="sm" onClick={() => handleClose(row.original)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddEntry(row.original)}
                >
                  Add entry (DCA)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleProfitToPosition(row.original)}
                >
                  Profit to position
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePartialClose(row.original)}
                >
                  Partial close
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCloseWithOrder(row.original)}
                >
                  Close with order
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDelete(row.original)}
            >
              Delete
            </Button>
          </div>
        ),
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
          <CardTitle>Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Total PnL</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Loading...' : (stats?.totalPnL ?? '0')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trades (CLOSED)</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Loading...' : (stats?.tradesCount ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Win rate</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Loading...' : formatWinRate(stats?.winRate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg PnL</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Loading...' : (stats?.avgPnL ?? '0')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fees total</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Loading...' : (stats?.feesTotal ?? '0')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open deals</p>
              <p className="text-lg font-semibold">
                {statsLoading ? 'Loading...' : (stats?.openCount ?? 0)}
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
            <CardTitle>Deals</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manual deals overview.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <Input
              type="date"
              value={draftFilters.from}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  from: event.target.value,
                }))
              }
            />
            <Input
              type="date"
              value={draftFilters.to}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  to: event.target.value,
                }))
              }
            />
            <Input
              placeholder="Symbol"
              value={draftFilters.symbol}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  symbol: event.target.value.toUpperCase(),
                }))
              }
            />
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
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="OPEN">OPEN</SelectItem>
                <SelectItem value="CLOSED">CLOSED</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleApply}>
                Apply
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
              <Button onClick={() => setCreateOpen(true)}>Create deal</Button>
              <Button
                variant="outline"
                onClick={() => setOpenWithOrderOpen(true)}
              >
                Open with order
              </Button>
            </div>
          </div>

          {notice && (
            <p className="text-sm text-emerald-600" role="status">
              {notice}
            </p>
          )}
          {dealsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading deals...</p>
          )}
          {dealsQuery.error instanceof Error && (
            <p className="text-sm text-destructive">
              {dealsQuery.error.message}
            </p>
          )}

          {!dealsQuery.isLoading && (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
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
                      <TableCell colSpan={columns.length}>
                        No deals found.
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
