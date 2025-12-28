import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { importDealTrades } from '@/api/dealsApi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type Deal, type ImportTradesResponse } from '@/types/deals'
import { formatMoneyLike, formatPrice, formatQty } from '@/lib/format'

type ImportTradesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal: Deal
  phase: 'ENTRY' | 'EXIT'
  onSuccess?: (message: string) => void
}

export default function ImportTradesDialog({
  open,
  onOpenChange,
  deal,
  phase,
  onSuccess,
}: ImportTradesDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [orderId, setOrderId] = useState('')
  const [preview, setPreview] = useState<ImportTradesResponse | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setOrderId('')
    setPreview(null)
    setHasLoaded(false)
    setIsLoading(false)
    setIsApplying(false)
    setError(null)
  }, [open, deal.id, phase])
  const aggregate = preview?.aggregate
  const previewRows = preview?.preview ?? []
  const parseOrderId = () => {
    const value = Number(orderId)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Нужно указать Order ID')
      return null
    }
    return value
  }
  const handleLoadPreview = async () => {
    const parsedOrderId = parseOrderId()
    if (!parsedOrderId) return
    setError(null)
    setIsLoading(true)
    try {
      const result = await importDealTrades(
        deal.id,
        { phase, orderId: parsedOrderId },
        { accessToken, onUnauthorized: refresh },
      )
      setPreview(result)
      setHasLoaded(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить превью',
      )
    } finally {
      setIsLoading(false)
    }
  }
  const handleApply = async () => {
    const parsedOrderId = parseOrderId()
    if (!parsedOrderId) return
    setError(null)
    setIsApplying(true)
    try {
      const result = await importDealTrades(
        deal.id,
        { phase, orderId: parsedOrderId },
        { accessToken, onUnauthorized: refresh },
      )
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.(
        `Импортировано сделок: ${result.importedCount} (${phase === 'ENTRY' ? 'вход' : 'выход'})`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось импортировать')
    } finally {
      setIsApplying(false)
    }
  }
  const disableLoad = isLoading || isApplying || orderId.trim().length === 0
  const disableApply = isApplying || isLoading || !hasLoaded

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {phase === 'ENTRY' ? 'Импорт сделок входа' : 'Импорт сделок выхода'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="import-order-id">Order ID</Label>
              <Input
                id="import-order-id"
                type="number"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Order ID можно посмотреть в Spot → Open orders / Recent trades.
              </p>
              <p className="text-xs text-muted-foreground">
                Импорт подтянет исполнения (fills) и заполнит вход/выход.
              </p>
            </div>
            <Button onClick={handleLoadPreview} disabled={disableLoad}>
              {isLoading ? 'Загрузка...' : 'Показать превью'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Превью</p>
            {previewRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет сделок</p>
            ) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Время</TableHead>
                      <TableHead>Сторона</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Количество</TableHead>
                      <TableHead>Quote</TableHead>
                      <TableHead>Комиссия (asset)</TableHead>
                      <TableHead>Комиссия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>
                          {new Date(trade.time).toLocaleString()}
                        </TableCell>
                        <TableCell>{trade.isBuyer ? 'BUY' : 'SELL'}</TableCell>
                        <TableCell>{formatPrice(trade.price)}</TableCell>
                        <TableCell>{formatQty(trade.qty)}</TableCell>
                        <TableCell>{formatMoneyLike(trade.quoteQty)}</TableCell>
                        <TableCell>{trade.commissionAsset}</TableCell>
                        <TableCell>
                          {formatMoneyLike(trade.commission)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Агрегат</p>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Количество</p>
                <p className="text-sm font-medium">
                  {formatQty(aggregate?.qty)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Средняя цена</p>
                <p className="text-sm font-medium">
                  {formatPrice(aggregate?.price)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quote</p>
                <p className="text-sm font-medium">
                  {formatMoneyLike(aggregate?.quote)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Комиссия</p>
                <p className="text-sm font-medium">
                  {aggregate?.fee
                    ? `${formatMoneyLike(aggregate.fee)} ${aggregate.feeAsset ?? ''}`.trim()
                    : '-'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
            <Button onClick={handleApply} disabled={disableApply}>
              {isApplying ? 'Применяем...' : 'Применить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
