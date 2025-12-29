import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { updateDeal } from '@/api/dealsApi'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatInputValue } from '@/lib/format'
import { toastError } from '@/lib/toast'
import { type Deal } from '@/types/deals'
import { editDealSchema, type EditDealFormValues } from '@/validation/deals'

type EditDealDialogProps = {
  deal: Deal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

function formatDateInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export default function EditDealDialog({
  deal,
  open,
  onOpenChange,
  onSuccess,
}: EditDealDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()

  const form = useForm<EditDealFormValues>({
    resolver: zodResolver(editDealSchema),
    defaultValues: {
      symbol: '',
      direction: 'LONG',
      openedAt: '',
      entry: {
        qty: '',
        price: '',
        fee: undefined,
        feeAsset: '',
      },
      note: '',
    },
  })

  useEffect(() => {
    if (!deal || !open) return
    form.reset({
      symbol: deal.symbol,
      direction: deal.direction,
      openedAt: formatDateInput(deal.openedAt),
      entry: {
        qty: formatInputValue(deal.entry.qty, 'qty'),
        price: formatInputValue(deal.entry.price, 'price'),
        fee: deal.entry.fee ? formatInputValue(deal.entry.fee, 'money') : '',
        feeAsset: deal.entry.feeAsset ?? '',
      },
      note: deal.note ?? '',
    })
  }, [deal, open, form])

  const updateMutation = useMutation({
    mutationFn: async (values: EditDealFormValues) => {
      if (!deal) {
        throw new Error('No deal selected')
      }
      const payload = {
        symbol: values.symbol.trim().toUpperCase(),
        direction: values.direction,
        openedAt: new Date(values.openedAt).toISOString(),
        note: values.note?.trim() || undefined,
        entry: {
          qty: values.entry.qty,
          price: values.entry.price,
          fee: values.entry.fee || undefined,
          feeAsset: values.entry.feeAsset?.trim() || undefined,
        },
      }
      return updateDeal(deal.id, payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.('Сделка обновлена')
    },
    onError: (error) => {
      if (error instanceof Error) {
        toastError(`Ошибка обновления: ${error.message}`)
        return
      }
      toastError('Ошибка обновления: неизвестная ошибка')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать сделку</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            updateMutation.mutate(values),
          )}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-deal-symbol">Символ</Label>
              <Input id="edit-deal-symbol" {...form.register('symbol')} />
              {form.formState.errors.symbol && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.symbol.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-direction">Направление</Label>
              <Select
                value={form.watch('direction')}
                onValueChange={(value) =>
                  form.setValue(
                    'direction',
                    value as EditDealFormValues['direction'],
                  )
                }
              >
                <SelectTrigger id="edit-deal-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LONG">LONG</SelectItem>
                  <SelectItem value="SHORT">SHORT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-opened-at">Дата открытия</Label>
              <Input
                id="edit-deal-opened-at"
                type="date"
                {...form.register('openedAt')}
              />
              {form.formState.errors.openedAt && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.openedAt.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-entry-qty">Объем входа (qty)</Label>
              <Input
                id="edit-deal-entry-qty"
                inputMode="decimal"
                {...form.register('entry.qty')}
              />
              {form.formState.errors.entry?.qty && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.entry.qty.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Количество в базовой валюте.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-entry-price">Цена входа</Label>
              <Input
                id="edit-deal-entry-price"
                inputMode="decimal"
                {...form.register('entry.price')}
              />
              {form.formState.errors.entry?.price && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.entry.price.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Цена в котируемой валюте (обычно USDT).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-entry-fee">Комиссия входа</Label>
              <Input
                id="edit-deal-entry-fee"
                inputMode="decimal"
                {...form.register('entry.fee')}
              />
              {form.formState.errors.entry?.fee && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.entry.fee.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-entry-fee-asset">Актив комиссии</Label>
              <Input
                id="edit-deal-entry-fee-asset"
                {...form.register('entry.feeAsset')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-deal-note">Заметка</Label>
              <Input id="edit-deal-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
