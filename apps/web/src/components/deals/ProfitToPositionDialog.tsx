import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { profitToPosition } from '@/api/dealsApi'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { fromLocalDateIso, toLocalDateIso } from '@/lib/dateLocal'
import { type Deal } from '@/types/deals'
import {
  formatMoneyDisplay,
  formatPriceDisplay,
  formatQtyDisplay,
} from '@/lib/format'
import { toastError } from '@/lib/toast'
import {
  profitToPositionSchema,
  type ProfitToPositionFormValues,
} from '@/validation/deals'

type ProfitToPositionDialogProps = {
  deal: Deal | null
  availableProfit?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

export default function ProfitToPositionDialog({
  deal,
  availableProfit,
  open,
  onOpenChange,
  onSuccess,
}: ProfitToPositionDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const resolvedAvailable = availableProfit ?? deal?.realizedPnlAvailable ?? '0'

  const form = useForm<ProfitToPositionFormValues>({
    resolver: zodResolver(profitToPositionSchema),
    defaultValues: {
      amount: '',
      price: '',
      at: toLocalDateIso(new Date()),
      note: '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      amount: '',
      price: '',
      at: toLocalDateIso(new Date()),
      note: '',
    })
  }, [open, form])

  const profitMutation = useMutation({
    mutationFn: async (values: ProfitToPositionFormValues) => {
      if (!deal) {
        throw new Error('No deal selected')
      }
      if (Number.isFinite(Number(resolvedAvailable))) {
        if (Number(values.amount) > Number(resolvedAvailable)) {
          throw new Error('Сумма превышает доступную прибыль')
        }
      }
      const payload = {
        amount: values.amount,
        price: values.price,
        at: values.at ? toLocalDateIso(fromLocalDateIso(values.at)) : undefined,
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
      onSuccess?.('Прибыль реинвестирована')
    },
    onError: (error) => {
      if (error instanceof Error) {
        toastError(`Ошибка реинвеста: ${error.message}`)
        return
      }
      toastError('Ошибка реинвеста: неизвестная ошибка')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Реинвестировать прибыль</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            profitMutation.mutate(values),
          )}
        >
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Доступная прибыль (все сделки):{' '}
              {formatMoneyDisplay(resolvedAvailable)}
            </p>
            <p className="text-xs text-muted-foreground">
              Сумма будет учтена как новый вход (DCA) без отправки ордера.
            </p>
            <p className="text-xs text-muted-foreground">
              Расчёт PnL выполнен от средней цены входа.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profit-amount">Сумма (quote)</Label>
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
              <Label htmlFor="profit-price">Цена</Label>
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
              <Label htmlFor="profit-at">Дата</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !form.watch('at') && 'text-muted-foreground',
                    )}
                  >
                    {form.watch('at')
                      ? format(fromLocalDateIso(form.watch('at')), 'dd.MM.yyyy')
                      : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.watch('at')
                        ? fromLocalDateIso(form.watch('at'))
                        : undefined
                    }
                    onSelect={(date: Date | undefined) =>
                      form.setValue(
                        'at',
                        date ? toLocalDateIso(date) : form.getValues('at'),
                        { shouldValidate: true, shouldDirty: true },
                      )
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.at && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.at.message}
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profit-note">Заметка</Label>
              <Input id="profit-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs text-muted-foreground">
                Примерный объём:{' '}
                {formatQtyDisplay(
                  Number(form.watch('amount')) && Number(form.watch('price'))
                    ? String(
                        Number(form.watch('amount')) /
                          Number(form.watch('price')),
                      )
                    : undefined,
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Оценка цены: {formatPriceDisplay(form.watch('price'))}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={profitMutation.isPending}>
              {profitMutation.isPending ? 'Применяем...' : 'Реинвестировать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
