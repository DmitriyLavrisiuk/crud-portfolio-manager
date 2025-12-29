import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DealHistoryTable from '@/components/deals/DealHistoryTable'
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

const formatCountLabel = (shown: number, total: number) =>
  `Показано: ${shown} · Всего: ${total}`

const isHistoryTab = (value: string): value is DealHistoryTab =>
  value === 'all' ||
  value === 'dca' ||
  value === 'reinvest' ||
  value === 'closes'

export default function DealHistoryPanel({ events }: DealHistoryPanelProps) {
  const [tab, setTab] = useState<DealHistoryTab>('all')

  const filteredEvents = useMemo(() => {
    if (tab !== 'all') {
      const type = typeByTab[tab]
      return events.filter((event) => event.type === type)
    }
    return events
  }, [events, tab])

  const countLabel = formatCountLabel(filteredEvents.length, events.length)

  return (
    <div className="space-y-3">
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
          {filteredEvents.length ? (
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
