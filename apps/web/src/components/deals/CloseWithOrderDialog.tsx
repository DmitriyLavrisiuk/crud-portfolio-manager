import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { closeDealWithOrder, type DealsListFilters } from '@/api/dealsApi'
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
import { toastError, toastWarning } from '@/lib/toast'
import { type Deal } from '@/types/deals'
import {
  closeWithOrderSchema,
  type CloseWithOrderFormValues,
} from '@/validation/deals'

type CloseWithOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal: Deal
  onSuccess?: (message: string) => void
  queryFilters: DealsListFilters
}

const getCloseSide = (deal: Deal) =>
  deal.direction === 'LONG' ? 'SELL' : 'BUY'

export default function CloseWithOrderDialog({
  open,
  onOpenChange,
  deal,
  onSuccess,
  queryFilters,
}: CloseWithOrderDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const closeSide = getCloseSide(deal)

  const form = useForm<CloseWithOrderFormValues>({
    resolver: zodResolver(closeWithOrderSchema),
    defaultValues: {
      closeSide,
      marketBuyMode: closeSide === 'BUY' ? 'BASE' : undefined,
      quantity: deal.entry?.qty ? formatInputValue(deal.entry.qty, 'qty') : '',
      quoteOrderQty: '',
      note: '',
    },
    mode: 'onChange',
  })

  const marketBuyMode = form.watch('marketBuyMode')

  useEffect(() => {
    if (!open) return
    form.reset({
      closeSide,
      marketBuyMode: closeSide === 'BUY' ? 'BASE' : undefined,
      quantity: deal.entry?.qty ? formatInputValue(deal.entry.qty, 'qty') : '',
      quoteOrderQty: '',
      note: '',
    })
  }, [open, form, closeSide, deal.entry?.qty])

  const dealsQueryKey = useMemo(() => ['deals', queryFilters], [queryFilters])
  const statsQueryKey = useMemo(
    () => ['dealsStats', queryFilters],
    [queryFilters],
  )

  const mutation = useMutation({
    mutationFn: async (values: CloseWithOrderFormValues) => {
      const payload = {
        marketBuyMode: closeSide === 'BUY' ? values.marketBuyMode : undefined,
        quoteOrderQty: values.quoteOrderQty?.trim() || undefined,
        quantity: values.quantity?.trim() || undefined,
        note: values.note?.trim() || undefined,
      }
      return closeDealWithOrder(deal.id, payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealsQueryKey })
      queryClient.invalidateQueries({ queryKey: statsQueryKey })
      onOpenChange(false)
      onSuccess?.('Сделка закрыта через рыночный ордер')
    },
    onError: (error) => {
      const data = (
        error as { data?: { statusCode?: number; message?: string } }
      ).data
      const message =
        typeof data?.message === 'string'
          ? data.message
          : error instanceof Error
            ? error.message
            : 'Failed to close deal'
      if (
        data?.statusCode === 409 &&
        message.toLowerCase().includes('no fills')
      ) {
        toastWarning('fills ещё не доступны, попробуй позже')
        return
      }
      toastError(`Ошибка закрытия: ${message}`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Закрыть через ордер</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Сторона закрытия</Label>
              <Input value={closeSide} readOnly />
            </div>
            {closeSide === 'BUY' && (
              <div className="space-y-2">
                <Label htmlFor="close-order-buy-mode">Режим покупки</Label>
                <Select
                  value={marketBuyMode ?? 'BASE'}
                  onValueChange={(value) =>
                    form.setValue(
                      'marketBuyMode',
                      value as CloseWithOrderFormValues['marketBuyMode'],
                      { shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger id="close-order-buy-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUOTE">QUOTE</SelectItem>
                    <SelectItem value="BASE">BASE</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  QUOTE — купить на сумму (в котируемой валюте, обычно USDT).
                </p>
                <p className="text-xs text-muted-foreground">
                  BASE — купить/продать количество (в базовой валюте).
                </p>
              </div>
            )}
            {(closeSide === 'SELL' || marketBuyMode === 'BASE') && (
              <div className="space-y-2">
                <Label htmlFor="close-order-qty">Количество</Label>
                <Input
                  id="close-order-qty"
                  inputMode="decimal"
                  {...form.register('quantity')}
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.quantity.message}
                  </p>
                )}
              </div>
            )}
            {closeSide === 'BUY' && marketBuyMode === 'QUOTE' && (
              <div className="space-y-2">
                <Label htmlFor="close-order-quote">Сумма в quote</Label>
                <Input
                  id="close-order-quote"
                  inputMode="decimal"
                  {...form.register('quoteOrderQty')}
                />
                {form.formState.errors.quoteOrderQty && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.quoteOrderQty.message}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="close-order-note">Заметка</Label>
              <Input id="close-order-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!form.formState.isValid || mutation.isPending}
            >
              {mutation.isPending ? 'Отправляем...' : 'Закрыть через ордер'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
