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
      setError('Order ID is required')
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
      setError(err instanceof Error ? err.message : 'Failed to load preview')
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
      onSuccess?.(`Imported ${result.importedCount} trades into ${phase}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import trades')
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
          <DialogTitle>{`Import ${phase} trades`}</DialogTitle>
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
            </div>
            <Button onClick={handleLoadPreview} disabled={disableLoad}>
              {isLoading ? 'Loading...' : 'Load preview'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Preview</p>
            {previewRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades</p>
            ) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Quote</TableHead>
                      <TableHead>Fee Asset</TableHead>
                      <TableHead>Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>
                          {new Date(trade.time).toLocaleString()}
                        </TableCell>
                        <TableCell>{trade.isBuyer ? 'BUY' : 'SELL'}</TableCell>
                        <TableCell>{trade.price}</TableCell>
                        <TableCell>{trade.qty}</TableCell>
                        <TableCell>{trade.quoteQty}</TableCell>
                        <TableCell>{trade.commissionAsset}</TableCell>
                        <TableCell>{trade.commission}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Aggregate</p>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Qty</p>
                <p className="text-sm font-medium">{aggregate?.qty ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Price</p>
                <p className="text-sm font-medium">{aggregate?.price ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quote</p>
                <p className="text-sm font-medium">{aggregate?.quote ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fee</p>
                <p className="text-sm font-medium">
                  {aggregate?.fee
                    ? `${aggregate.fee} ${aggregate.feeAsset ?? ''}`.trim()
                    : '-'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleApply} disabled={disableApply}>
              {isApplying ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
