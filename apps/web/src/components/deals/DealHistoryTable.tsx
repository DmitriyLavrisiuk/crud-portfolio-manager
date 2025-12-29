import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  type Cell,
  type ColumnDef,
  flexRender,
  type Header,
  type HeaderGroup,
  type Row,
} from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatMoneyDisplay,
  formatPriceDisplay,
  formatQtyDisplay,
} from '@/lib/format'
import { useAppTable } from '@/lib/table'
import type { DealHistoryEvent } from '@/lib/dealsHistory'

type DealHistoryTableProps = {
  events: DealHistoryEvent[]
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return format(date, 'dd.MM.yyyy HH:mm')
}

const getTypeBadge = (type: DealHistoryEvent['type']) => {
  switch (type) {
    case 'DCA':
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          DCA
        </Badge>
      )
    case 'PROFIT_REINVEST':
      return (
        <Badge variant="outline" className="text-emerald-600">
          Реинвест
        </Badge>
      )
    case 'PARTIAL_CLOSE':
      return (
        <Badge variant="outline" className="text-amber-600">
          Частичное закрытие
        </Badge>
      )
    default:
      return <Badge variant="outline">{type}</Badge>
  }
}

const getSignedClass = (value?: string | number) => {
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
}

export default function DealHistoryTable({ events }: DealHistoryTableProps) {
  const columns = useMemo<ColumnDef<DealHistoryEvent>[]>(
    () => [
      {
        accessorKey: 'at',
        header: 'Дата',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) =>
          formatDateTime(row.original.at),
      },
      {
        accessorKey: 'type',
        header: 'Тип',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) =>
          getTypeBadge(row.original.type),
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) =>
          row.original.qty ? formatQtyDisplay(row.original.qty) : '-',
      },
      {
        accessorKey: 'price',
        header: 'Цена',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) =>
          row.original.price ? formatPriceDisplay(row.original.price) : '-',
      },
      {
        accessorKey: 'quote',
        header: 'Сумма',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) =>
          row.original.quote ? formatMoneyDisplay(row.original.quote) : '-',
      },
      {
        id: 'fee',
        header: 'Комиссия',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) => {
          const fee = row.original.fee
          if (!fee) return '-'
          const asset = row.original.feeAsset ?? ''
          return `${formatMoneyDisplay(fee)} ${asset}`.trim()
        },
      },
      {
        accessorKey: 'pnl',
        header: 'PnL',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) => (
          <span className={getSignedClass(row.original.pnl)}>
            {row.original.pnl ? formatMoneyDisplay(row.original.pnl) : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'note',
        header: 'Примечание',
        cell: ({ row }: { row: Row<DealHistoryEvent> }) =>
          row.original.note?.trim() || '-',
      },
    ],
    [],
  )

  const table = useAppTable({
    data: events,
    columns,
  })

  return (
    <div className="rounded-md border border-border bg-background">
      <Table>
        <TableHeader>
          {table
            .getHeaderGroups()
            .map((headerGroup: HeaderGroup<DealHistoryEvent>) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(
                  (header: Header<DealHistoryEvent, unknown>) => (
                    <TableHead
                      key={header.id}
                      className="px-3 py-2 text-xs font-medium text-muted-foreground"
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
            table.getRowModel().rows.map((row: Row<DealHistoryEvent>) => (
              <TableRow key={row.id}>
                {row
                  .getVisibleCells()
                  .map((cell: Cell<DealHistoryEvent, unknown>) => (
                    <TableCell key={cell.id} className="px-3 py-2 text-sm">
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
                colSpan={columns.length}
                className="py-4 text-center text-sm text-muted-foreground"
              >
                Нет операций по сделке.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
