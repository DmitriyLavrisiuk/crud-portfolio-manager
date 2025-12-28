import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { profitToPosition } from '@/api/dealsApi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Deal } from '@/types/deals'
import {
  profitToPositionSchema,
  type ProfitToPositionFormValues,
} from '@/validation/deals'

type ProfitToPositionDialogProps = {
  deal: Deal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

function getAvailableProfit(deal: Deal | null) {
  if (!deal) return '0'
  if (deal.realizedPnlAvailable !== undefined) {
    return deal.realizedPnlAvailable
  }
  if (deal.realizedPnl && deal.profitSpentTotal) {
    const available = Number(deal.realizedPnl) - Number(deal.profitSpentTotal)
    if (Number.isFinite(available)) {
      return available.toString()
    }
  }
  return deal.realizedPnl ?? '0'
}

export default function ProfitToPositionDialog({
  deal,
  open,
  onOpenChange,
  onSuccess,
}: ProfitToPositionDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const availableProfit = useMemo(() => getAvailableProfit(deal), [deal])

  const form = useForm<ProfitToPositionFormValues>({
    resolver: zodResolver(profitToPositionSchema),
    defaultValues: {
      amount: '',
      price: '',
      at: new Date().toISOString().slice(0, 10),
      note: '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      amount: '',
      price: '',
      at: new Date().toISOString().slice(0, 10),
      note: '',
    })
  }, [open, form])

  const profitMutation = useMutation({
    mutationFn: async (values: ProfitToPositionFormValues) => {
      if (!deal) {
        throw new Error('No deal selected')
      }
      const payload = {
        amount: values.amount,
        price: values.price,
        at: values.at ? new Date(values.at).toISOString() : undefined,
        note: values.note?.trim() || undefined,
      }
      return profitToPosition(deal.id, payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.('Profit reinvested')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profit to Position</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            profitMutation.mutate(values),
          )}
        >
          <p className="text-sm text-muted-foreground">
            Available profit: {availableProfit}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profit-amount">Amount (quote)</Label>
              <Input
                id="profit-amount"
                inputMode="decimal"
                {...form.register('amount')}
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profit-price">Price</Label>
              <Input
                id="profit-price"
                inputMode="decimal"
                {...form.register('price')}
              />
              {form.formState.errors.price && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.price.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profit-at">At</Label>
              <Input id="profit-at" type="date" {...form.register('at')} />
              {form.formState.errors.at && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.at.message}
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profit-note">Note</Label>
              <Input id="profit-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          {profitMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {profitMutation.error.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={profitMutation.isPending}>
              {profitMutation.isPending ? 'Applying...' : 'Reinvest'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
