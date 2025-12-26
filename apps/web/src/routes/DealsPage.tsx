import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { useAuth } from '@/auth/AuthProvider'
import { fetchDeals } from '@/api/dealsApi'
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
  const [draftFilters, setDraftFilters] =
    useState<FiltersState>(getDefaultFilters())
  const [appliedFilters, setAppliedFilters] =
    useState<FiltersState>(getDefaultFilters())

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

  const data = useMemo(() => dealsQuery.data?.items ?? [], [dealsQuery.data])

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
        id: 'exitQuote',
        header: 'Exit Quote',
        cell: ({ row }) => row.original.exit?.quote ?? '-',
      },
      {
        accessorKey: 'realizedPnl',
        header: 'PnL',
        cell: ({ row }) => row.original.realizedPnl ?? '-',
      },
    ],
    [],
  )

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
            </div>
          </div>

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
    </section>
  )
}
