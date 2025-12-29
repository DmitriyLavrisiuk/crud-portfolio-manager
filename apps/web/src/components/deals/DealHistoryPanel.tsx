import { useEffect, useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
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
  const [visibleCount, setVisibleCount] = useState(10)

  const filteredEvents = useMemo(() => {
    if (tab !== 'all') {
      const type = typeByTab[tab]
      return events.filter((event) => event.type === type)
    }
    return events
  }, [events, tab])

  useEffect(() => {
    setVisibleCount(10)
  }, [tab, events])

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount],
  )

  const countLabel = formatCountLabel(
    visibleEvents.length,
    filteredEvents.length,
  )

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
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <DealHistoryTable events={visibleEvents} />
              </div>
              {filteredEvents.length > 10 && (
                <div className="flex items-center justify-start">
                  {visibleCount < filteredEvents.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() =>
                        setVisibleCount((prev) =>
                          Math.min(prev + 10, filteredEvents.length),
                        )
                      }
                    >
                      Показать еще
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setVisibleCount(10)}
                    >
                      Свернуть
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <EmptyState title="Нет операций по выбранному фильтру" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
