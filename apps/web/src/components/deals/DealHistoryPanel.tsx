import { useMemo, useState } from 'react'
import { ArrowDownRight, Plus, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DealHistoryTable from '@/components/deals/DealHistoryTable'
import { cn } from '@/lib/utils'
import type { DealHistoryEvent } from '@/lib/dealsHistory'

type DealHistoryTab = 'all' | 'dca' | 'reinvest' | 'closes'

type DealHistoryPanelProps = {
  events: DealHistoryEvent[]
}

const typeByTab: Record<
  Exclude<DealHistoryTab, 'all'>,
  DealHistoryEvent['type']
> = {
  dca: 'DCA',
  reinvest: 'PROFIT_REINVEST',
  closes: 'PARTIAL_CLOSE',
}

const formatCountLabel = (shown: number, total: number, tab: DealHistoryTab) =>
  tab === 'all' ? `Показано: ${shown} · Всего: ${total}` : `Показано: ${shown}`

const isHistoryTab = (value: string): value is DealHistoryTab =>
  value === 'all' ||
  value === 'dca' ||
  value === 'reinvest' ||
  value === 'closes'

export default function DealHistoryPanel({ events }: DealHistoryPanelProps) {
  const [tab, setTab] = useState<DealHistoryTab>('all')
  const [selectedTypes, setSelectedTypes] = useState({
    DCA: true,
    PROFIT_REINVEST: true,
    PARTIAL_CLOSE: true,
  })

  const hasAnyTypeSelected =
    selectedTypes.DCA ||
    selectedTypes.PROFIT_REINVEST ||
    selectedTypes.PARTIAL_CLOSE

  const filteredEvents = useMemo(() => {
    if (tab !== 'all') {
      const type = typeByTab[tab]
      return events.filter((event) => event.type === type)
    }
    if (!hasAnyTypeSelected) {
      return []
    }
    return events.filter((event) => selectedTypes[event.type])
  }, [events, tab, selectedTypes, hasAnyTypeSelected])

  const countLabel = formatCountLabel(filteredEvents.length, events.length, tab)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">История операций</p>
        <p className="text-xs text-muted-foreground">
          DCA / Реинвест / Частичное закрытие
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value: string) =>
          setTab(isHistoryTab(value) ? value : 'all')
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-8 p-0.5">
            <TabsTrigger value="all" className="px-2 text-xs">
              Все
            </TabsTrigger>
            <TabsTrigger value="dca" className="px-2 text-xs">
              DCA
            </TabsTrigger>
            <TabsTrigger value="reinvest" className="px-2 text-xs">
              Реинвест
            </TabsTrigger>
            <TabsTrigger value="closes" className="px-2 text-xs">
              Закрытия
            </TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground">{countLabel}</p>
        </div>
        <TabsContent value={tab} className="space-y-3">
          {tab === 'all' && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={selectedTypes.DCA ? 'secondary' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 px-2 text-xs',
                  selectedTypes.DCA && 'text-foreground',
                )}
                onClick={() =>
                  setSelectedTypes((prev) => ({ ...prev, DCA: !prev.DCA }))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                DCA
              </Button>
              <Button
                variant={
                  selectedTypes.PROFIT_REINVEST ? 'secondary' : 'outline'
                }
                size="sm"
                className={cn(
                  'h-7 px-2 text-xs',
                  selectedTypes.PROFIT_REINVEST && 'text-foreground',
                )}
                onClick={() =>
                  setSelectedTypes((prev) => ({
                    ...prev,
                    PROFIT_REINVEST: !prev.PROFIT_REINVEST,
                  }))
                }
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Реинвест
              </Button>
              <Button
                variant={selectedTypes.PARTIAL_CLOSE ? 'secondary' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 px-2 text-xs',
                  selectedTypes.PARTIAL_CLOSE && 'text-foreground',
                )}
                onClick={() =>
                  setSelectedTypes((prev) => ({
                    ...prev,
                    PARTIAL_CLOSE: !prev.PARTIAL_CLOSE,
                  }))
                }
              >
                <ArrowDownRight className="h-3.5 w-3.5" />
                Закрытия
              </Button>
            </div>
          )}
          {tab === 'all' && !hasAnyTypeSelected ? (
            <p className="text-sm text-muted-foreground">
              Выберите хотя бы один тип.
            </p>
          ) : filteredEvents.length ? (
            <div className="overflow-x-auto">
              <DealHistoryTable events={filteredEvents} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Нет операций по сделке.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
