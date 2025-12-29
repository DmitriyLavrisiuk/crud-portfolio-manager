import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type Cell,
  type ColumnDef,
  flexRender,
  type Header,
  type HeaderGroup,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react'
import type { CheckedState } from '@radix-ui/react-checkbox'

import { useAuth } from '@/auth/AuthProvider'
import { bulkDeleteDeals, fetchDeals, fetchDealsStats } from '@/api/dealsApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  formatMoneyDisplay,
  formatPriceDisplay,
  formatQtyDisplay,
} from '@/lib/format'
import { useAppTable } from '@/lib/table'
import { toastError, toastSuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { buildDealHistoryEvents } from '@/lib/dealsHistory'
import { fromLocalDateIso, toLocalDateIso } from '@/lib/dateLocal'
import CreateDealDialog from '@/components/deals/CreateDealDialog'
import EditDealDialog from '@/components/deals/EditDealDialog'
import CloseDealDialog from '@/components/deals/CloseDealDialog'
import PartialCloseDealDialog from '@/components/deals/PartialCloseDealDialog'
import AddEntryLegDialog from '@/components/deals/AddEntryLegDialog'
import ProfitToPositionDialog from '@/components/deals/ProfitToPositionDialog'
import ImportTradesDialog from '@/components/deals/ImportTradesDialog'
import OpenWithOrderDialog from '@/components/deals/OpenWithOrderDialog'
import CloseWithOrderDialog from '@/components/deals/CloseWithOrderDialog'
import DealHistoryPanel from '@/components/deals/DealHistoryPanel'
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
import EmptyState from '@/components/ui/empty-state'

type FiltersState = {
  from: Date | null
  to: Date | null
  status: 'ALL' | DealStatus
  symbol: string
}

type DatePreset = '1w' | '1m' | '3m' | '6m' | 'all' | null

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

function normalizeLocalDate(date: Date) {
  return fromLocalDateIso(toLocalDateIso(date))
}

function parseObjectIdTimestamp(id: string) {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return null
  }
  const seconds = Number.parseInt(id.slice(0, 8), 16)
  if (!Number.isFinite(seconds)) {
    return null
  }
  return seconds * 1000
}

function getDealTimestamp(deal: Deal) {
  if (deal.createdAt) {
    const created = Date.parse(deal.createdAt)
    if (!Number.isNaN(created)) {
      return created
    }
  }
  if (deal.openedAt) {
    const opened = Date.parse(deal.openedAt)
    if (!Number.isNaN(opened)) {
      return opened
    }
  }
  const fallback = parseObjectIdTimestamp(deal.id)
  return fallback ?? 0
}

const numericSort = (rowA: Row<Deal>, rowB: Row<Deal>, columnId: string) => {
  const rawA = rowA.getValue(columnId)
  const rawB = rowB.getValue(columnId)
  const numA = Number(rawA)
  const numB = Number(rawB)
  const valA = Number.isNaN(numA) ? 0 : numA
  const valB = Number.isNaN(numB) ? 0 : numB
  return valA === valB ? 0 : valA > valB ? 1 : -1
}

const getAvailablePnlValue = (deal: Deal) => {
  if (deal.realizedPnlAvailable !== undefined) {
    return Number(deal.realizedPnlAvailable)
  }
  if (deal.realizedPnl && deal.profitSpentTotal) {
    return Number(deal.realizedPnl) - Number(deal.profitSpentTotal)
  }
  return Number(deal.realizedPnl ?? 0)
}

export default function DealsPage() {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [draftFilters, setDraftFilters] =
    useState<FiltersState>(getDefaultFilters())
  const [appliedFilters, setAppliedFilters] =
    useState<FiltersState>(getDefaultFilters())
  const [statsOpen, setStatsOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [activePreset, setActivePreset] = useState<DatePreset>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [openWithOrderOpen, setOpenWithOrderOpen] = useState(false)
  const [editing, setEditing] = useState<Deal | null>(null)
  const [closing, setClosing] = useState<Deal | null>(null)
  const [partialClosing, setPartialClosing] = useState<Deal | null>(null)
  const [addingEntry, setAddingEntry] = useState<Deal | null>(null)
  const [profitToPosition, setProfitToPosition] = useState<Deal | null>(null)
  const [closingWithOrder, setClosingWithOrder] = useState<Deal | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sorting, setSorting] = useState<SortingState>([])
  const [importing, setImporting] = useState<{
    deal: Deal
    phase: 'ENTRY' | 'EXIT'
  } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('deals:stats:open')
      if (saved === '1') {
        setStatsOpen(true)
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('deals:stats:open', statsOpen ? '1' : '0')
    } catch {
      // ignore storage errors
    }
  }, [statsOpen])

  const showNotice = useCallback((message: string) => {
    toastSuccess(message)
  }, [])

  const applyPreset = useCallback((preset: DatePreset) => {
    setActivePreset(preset)
    if (preset === 'all') {
      setDraftFilters((prev) => ({
        ...prev,
        from: null,
        to: null,
      }))
      return
    }
    if (!preset) {
      return
    }
    const end = normalizeLocalDate(new Date())
    const start = normalizeLocalDate(new Date(end))
    if (preset === '1w') {
      start.setDate(start.getDate() - 7)
    } else if (preset === '1m') {
      start.setMonth(start.getMonth() - 1)
    } else if (preset === '3m') {
      start.setMonth(start.getMonth() - 3)
    } else if (preset === '6m') {
      start.setMonth(start.getMonth() - 6)
    }
    setDraftFilters((prev) => ({
      ...prev,
      from: start,
      to: end,
    }))
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
  const rankById = useMemo(() => {
    const sorted = [...data].sort((left, right) => {
      const leftTs = getDealTimestamp(left)
      const rightTs = getDealTimestamp(right)
      if (leftTs === rightTs) {
        return left.id.localeCompare(right.id)
      }
      return leftTs - rightTs
    })
    const map = new Map<string, number>()
    sorted.forEach((deal, index) => {
      map.set(deal.id, index + 1)
    })
    return map
  }, [data])

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

  useEffect(() => {
    const dataIds = new Set(data.map((deal) => deal.id))
    setExpandedRows((prev) => {
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

  const handleImport = useCallback((deal: Deal, phase: 'ENTRY' | 'EXIT') => {
    setImporting({ deal, phase })
  }, [])

  const toggleExpandedRow = useCallback((dealId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
      }
      return next
    })
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
        enableSorting: false,
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
        accessorFn: (row) => rankById.get(row.id) ?? 0,
        sortingFn: numericSort,
        cell: ({ row }: { row: Row<Deal> }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {rankById.get(row.original.id) ?? row.index + 1}
          </span>
        ),
        meta: {
          headerClassName: 'sticky left-10 z-30 bg-background text-xs',
          cellClassName: 'sticky left-10 z-20 bg-background',
          sizeClassName: 'w-10',
        },
      },
      {
        id: 'openedAt',
        accessorFn: (row) => Date.parse(row.openedAt ?? '') || 0,
        sortingFn: numericSort,
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
          const direction =
            typeof value === 'string' ? value : String(value ?? '')
          if (direction === 'LONG') {
            return (
              <Badge variant="outline" className="text-emerald-600">
                Лонг
              </Badge>
            )
          }
          if (direction === 'SHORT') {
            return (
              <Badge variant="outline" className="text-red-600">
                Шорт
              </Badge>
            )
          }
          return <Badge variant="outline">{direction}</Badge>
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
        accessorFn: (row) => Number(row.entry?.quote ?? 0),
        sortingFn: numericSort,
        header: 'Вход (quote)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatMoneyDisplay(row.original.entry?.quote),
      },
      {
        id: 'entryAvgPrice',
        accessorFn: (row) => Number(row.entryAvgPrice ?? row.entry?.price ?? 0),
        sortingFn: numericSort,
        header: 'Средняя цена входа',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatPriceDisplay(
            row.original.entryAvgPrice ?? row.original.entry?.price,
          ),
      },
      {
        id: 'closedQty',
        accessorFn: (row) => Number(row.closedQty ?? 0),
        sortingFn: numericSort,
        header: 'Закрыто (qty)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatQtyDisplay(row.original.closedQty),
      },
      {
        id: 'remainingQty',
        accessorFn: (row) => Number(row.remainingQty ?? 0),
        sortingFn: numericSort,
        header: 'Остаток (qty)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatQtyDisplay(row.original.remainingQty),
      },
      {
        id: 'exitQuote',
        accessorFn: (row) => Number(row.exit?.quote ?? 0),
        sortingFn: numericSort,
        header: 'Выход (quote)',
        cell: ({ row }: { row: Row<Deal> }) =>
          formatMoneyDisplay(row.original.exit?.quote),
      },
      {
        id: 'realizedPnl',
        accessorFn: (row) => Number(row.realizedPnl ?? 0),
        sortingFn: numericSort,
        header: 'PnL',
        cell: ({ row }: { row: Row<Deal> }) => (
          <span className={getSignedClass(row.original.realizedPnl)}>
            {formatMoneyDisplay(row.original.realizedPnl)}
          </span>
        ),
      },
      {
        id: 'realizedPnlAvailable',
        accessorFn: (row) => getAvailablePnlValue(row),
        sortingFn: numericSort,
        header: 'Доступная прибыль',
        cell: ({ row }: { row: Row<Deal> }) => {
          const deal = row.original
          if (deal.realizedPnlAvailable !== undefined) {
            return (
              <span className={getSignedClass(deal.realizedPnlAvailable)}>
                {formatMoneyDisplay(deal.realizedPnlAvailable)}
              </span>
            )
          }
          if (deal.realizedPnl && deal.profitSpentTotal) {
            const value =
              Number(deal.realizedPnl) - Number(deal.profitSpentTotal)
            return (
              <span className={getSignedClass(value)}>
                {Number.isFinite(value) ? formatMoneyDisplay(value) : '-'}
              </span>
            )
          }
          return (
            <span className={getSignedClass(deal.realizedPnl)}>
              {formatMoneyDisplay(deal.realizedPnl)}
            </span>
          )
        },
      },
      {
        id: 'actions',
        enableSorting: false,
        header: 'Действия',
        cell: ({ row }: { row: Row<Deal> }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Показать историю сделки"
              onClick={() => toggleExpandedRow(row.original.id)}
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform',
                  expandedRows.has(row.original.id) && 'rotate-90',
                )}
              />
            </Button>
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
          </div>
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
      handleImport,
      data,
      selectedIds,
      expandedRows,
      rankById,
      toggleExpandedRow,
      getSignedClass,
      setSelectedIds,
    ],
  )

  const stats = statsQuery.data
  const statsLoading = statsQuery.isLoading
  const statsError =
    statsQuery.error instanceof Error ? statsQuery.error.message : null

  useEffect(() => {
    if (dealsQuery.error instanceof Error) {
      toastError(`Ошибка загрузки сделок: ${dealsQuery.error.message}`)
    }
  }, [dealsQuery.error])

  useEffect(() => {
    if (statsError) {
      toastError(`Ошибка статистики: ${statsError}`)
    }
  }, [statsError])

  const selectedCount = selectedIds.size
  const table = useAppTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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
    setActivePreset(null)
  }

  return (
    <section className="space-y-6">
      <Card>
        <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
          <CardHeader className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Статистика</CardTitle>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Доступно:{' '}
                    <span className={getSignedClass(stats?.profitAvailable)}>
                      {statsLoading
                        ? '...'
                        : formatMoneyDisplay(stats?.profitAvailable ?? '0')}
                    </span>
                  </span>
                  <span>
                    PnL:{' '}
                    <span className={getSignedClass(stats?.totalPnL)}>
                      {statsLoading
                        ? '...'
                        : formatMoneyDisplay(stats?.totalPnL ?? '0')}
                    </span>
                  </span>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      statsOpen && 'rotate-180',
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Доступная прибыль
                  </p>
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      getSignedClass(stats?.profitAvailable),
                    )}
                  >
                    {statsLoading
                      ? 'Загрузка...'
                      : formatMoneyDisplay(stats?.profitAvailable ?? '0')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Реализовано PnL
                  </p>
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      getSignedClass(stats?.totalRealizedPnl),
                    )}
                  >
                    {statsLoading
                      ? 'Загрузка...'
                      : formatMoneyDisplay(stats?.totalRealizedPnl ?? '0')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Потрачено на реинвест
                  </p>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {statsLoading
                      ? 'Загрузка...'
                      : formatMoneyDisplay(stats?.totalProfitSpent ?? '0')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Общий PnL</p>
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      getSignedClass(stats?.totalPnL),
                    )}
                  >
                    {statsLoading
                      ? 'Загрузка...'
                      : formatMoneyDisplay(stats?.totalPnL ?? '0')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Комиссии</p>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {statsLoading
                      ? 'Загрузка...'
                      : formatMoneyDisplay(stats?.feesTotal ?? '0')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Сделок (закрытые)
                  </p>
                  <p className="text-sm font-semibold">
                    {statsLoading ? 'Загрузка...' : (stats?.tradesCount ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
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
                      onSelect={(date: Date | undefined) => {
                        setActivePreset(null)
                        setDraftFilters((prev) => ({
                          ...prev,
                          from: date ?? null,
                        }))
                      }}
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
                      onSelect={(date: Date | undefined) => {
                        setActivePreset(null)
                        setDraftFilters((prev) => ({
                          ...prev,
                          to: date ?? null,
                        }))
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                <Button
                  type="button"
                  variant={activePreset === '1w' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('1w')}
                >
                  1 неделя
                </Button>
                <Button
                  type="button"
                  variant={activePreset === '1m' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('1m')}
                >
                  1 месяц
                </Button>
                <Button
                  type="button"
                  variant={activePreset === '3m' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('3m')}
                >
                  3 месяца
                </Button>
                <Button
                  type="button"
                  variant={activePreset === '6m' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('6m')}
                >
                  6 месяцев
                </Button>
                <Button
                  type="button"
                  variant={activePreset === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('all')}
                >
                  Все время
                </Button>
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

          {dealsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Загрузка сделок...</p>
          )}
          {!dealsQuery.isLoading && data.length === 0 && (
            <EmptyState
              title="Сделок пока нет"
              description="Создайте сделку или откройте через ордер."
            />
          )}
          {!dealsQuery.isLoading && data.length > 0 && (
            <div className="w-full overflow-x-auto rounded-md border border-border">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  {table
                    .getHeaderGroups()
                    .map((headerGroup: HeaderGroup<Deal>) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(
                          (header: Header<Deal, unknown>) => {
                            const canSort = header.column.getCanSort()
                            const sortState = header.column.getIsSorted()
                            return (
                              <TableHead
                                key={header.id}
                                className={cn(
                                  'px-3 py-2 text-xs font-medium text-muted-foreground',
                                  header.column.columnDef.meta?.headerClassName,
                                  header.column.columnDef.meta?.sizeClassName,
                                )}
                              >
                                {header.isPlaceholder ? null : (
                                  <div
                                    className={cn(
                                      'flex items-center gap-1',
                                      canSort && 'cursor-pointer select-none',
                                    )}
                                    onClick={
                                      canSort
                                        ? header.column.getToggleSortingHandler()
                                        : undefined
                                    }
                                  >
                                    <span>
                                      {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext(),
                                      )}
                                    </span>
                                    {canSort &&
                                      (sortState === 'asc' ? (
                                        <ArrowUp className="h-3 w-3 text-foreground" />
                                      ) : sortState === 'desc' ? (
                                        <ArrowDown className="h-3 w-3 text-foreground" />
                                      ) : (
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                                      ))}
                                  </div>
                                )}
                              </TableHead>
                            )
                          },
                        )}
                      </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row: Row<Deal>) => {
                      const isExpanded = expandedRows.has(row.original.id)
                      const historyEvents = isExpanded
                        ? buildDealHistoryEvents(row.original)
                        : []
                      return (
                        <Fragment key={row.id}>
                          <TableRow>
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
                          {isExpanded && (
                            <TableRow>
                              <TableCell
                                colSpan={columns.length}
                                className="bg-muted/40 p-3"
                              >
                                <div className="space-y-3">
                                  <DealHistoryPanel events={historyEvents} />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
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
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сделки?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалено: {selectedCount}. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
