import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { closeDeal } from '@/api/dealsApi'
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
import { closeDealSchema, type CloseDealFormValues } from '@/validation/deals'

type CloseDealDialogProps = {
  deal: Deal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

export default function CloseDealDialog({
  deal,
  open,
  onOpenChange,
  onSuccess,
}: CloseDealDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()

  const form = useForm<CloseDealFormValues>({
    resolver: zodResolver(closeDealSchema),
    defaultValues: {
      closedAt: new Date().toISOString().slice(0, 10),
      exit: {
        qty: '',
        price: '',
        fee: undefined,
        feeAsset: '',
      },
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      closedAt: new Date().toISOString().slice(0, 10),
      exit: {
        qty: '',
        price: '',
        fee: undefined,
        feeAsset: '',
      },
    })
  }, [open, form])

  const closeMutation = useMutation({
    mutationFn: async (values: CloseDealFormValues) => {
      if (!deal) {
        throw new Error('No deal selected')
      }
      const payload = {
        closedAt: new Date(values.closedAt).toISOString(),
        exit: {
          qty: values.exit.qty,
          price: values.exit.price,
          fee: values.exit.fee || undefined,
          feeAsset: values.exit.feeAsset?.trim() || undefined,
        },
      }
      return closeDeal(deal.id, payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.('Сделка закрыта')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Закрыть сделку</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => closeMutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="close-deal-date">Дата закрытия</Label>
              <Input
                id="close-deal-date"
                type="date"
                {...form.register('closedAt')}
              />
              {form.formState.errors.closedAt && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.closedAt.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-deal-exit-qty">Объем выхода (qty)</Label>
              <Input
                id="close-deal-exit-qty"
                inputMode="decimal"
                {...form.register('exit.qty')}
              />
              {form.formState.errors.exit?.qty && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.exit.qty.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Количество в базовой валюте.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-deal-exit-price">Цена выхода</Label>
              <Input
                id="close-deal-exit-price"
                inputMode="decimal"
                {...form.register('exit.price')}
              />
              {form.formState.errors.exit?.price && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.exit.price.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Цена в котируемой валюте (обычно USDT).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-deal-exit-fee">Комиссия выхода</Label>
              <Input
                id="close-deal-exit-fee"
                inputMode="decimal"
                {...form.register('exit.fee')}
              />
              {form.formState.errors.exit?.fee && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.exit.fee.message}
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="close-deal-exit-fee-asset">Актив комиссии</Label>
              <Input
                id="close-deal-exit-fee-asset"
                {...form.register('exit.feeAsset')}
              />
            </div>
          </div>

          {closeMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {closeMutation.error.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={closeMutation.isPending}>
              {closeMutation.isPending ? 'Закрываем...' : 'Закрыть сделку'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
