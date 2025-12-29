import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { partialCloseDeal } from '@/api/dealsApi'
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
import { toastError } from '@/lib/toast'
import { type Deal } from '@/types/deals'
import {
  partialCloseDealSchema,
  type PartialCloseDealFormValues,
} from '@/validation/deals'

type PartialCloseDealDialogProps = {
  deal: Deal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

export default function PartialCloseDealDialog({
  deal,
  open,
  onOpenChange,
  onSuccess,
}: PartialCloseDealDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()

  const form = useForm<PartialCloseDealFormValues>({
    resolver: zodResolver(partialCloseDealSchema),
    defaultValues: {
      closedAt: toLocalDateIso(new Date()),
      exit: {
        qty: '',
        price: '',
        fee: undefined,
        feeAsset: '',
      },
      note: '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      closedAt: toLocalDateIso(new Date()),
      exit: {
        qty: '',
        price: '',
        fee: undefined,
        feeAsset: '',
      },
      note: '',
    })
  }, [open, form])

  const closeMutation = useMutation({
    mutationFn: async (values: PartialCloseDealFormValues) => {
      if (!deal) {
        throw new Error('No deal selected')
      }
      const payload = {
        closedAt: values.closedAt
          ? toLocalDateIso(fromLocalDateIso(values.closedAt))
          : undefined,
        exit: {
          qty: values.exit.qty,
          price: values.exit.price,
          fee: values.exit.fee || undefined,
          feeAsset: values.exit.feeAsset?.trim() || undefined,
        },
        note: values.note?.trim() || undefined,
      }
      return partialCloseDeal(deal.id, payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.('Сделка частично закрыта')
    },
    onError: (error) => {
      if (error instanceof Error) {
        toastError(`Ошибка частичного закрытия: ${error.message}`)
        return
      }
      toastError('Ошибка частичного закрытия: неизвестная ошибка')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Частичное закрытие</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => closeMutation.mutate(values))}
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Дата закрытия</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !form.watch('closedAt') && 'text-muted-foreground',
                      )}
                    >
                      {form.watch('closedAt')
                        ? format(
                            fromLocalDateIso(form.watch('closedAt')),
                            'dd.MM.yyyy',
                          )
                        : 'Выберите дату'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        form.watch('closedAt')
                          ? fromLocalDateIso(form.watch('closedAt'))
                          : undefined
                      }
                      onSelect={(date: Date | undefined) =>
                        form.setValue(
                          'closedAt',
                          date
                            ? toLocalDateIso(date)
                            : form.getValues('closedAt'),
                          { shouldValidate: true, shouldDirty: true },
                        )
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.closedAt && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.closedAt.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Выход
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="partial-close-exit-qty">
                    Объем выхода (qty)
                  </Label>
                  <Input
                    id="partial-close-exit-qty"
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
                  <Label htmlFor="partial-close-exit-price">Цена выхода</Label>
                  <Input
                    id="partial-close-exit-price"
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
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Label htmlFor="partial-close-exit-fee">
                    Комиссия выхода
                  </Label>
                  <Input
                    id="partial-close-exit-fee"
                    inputMode="decimal"
                    {...form.register('exit.fee')}
                  />
                  {form.formState.errors.exit?.fee && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.exit.fee.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partial-close-exit-fee-asset">Актив</Label>
                  <Input
                    id="partial-close-exit-fee-asset"
                    {...form.register('exit.feeAsset')}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partial-close-note">Заметка</Label>
              <Input id="partial-close-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={closeMutation.isPending}>
              {closeMutation.isPending ? 'Закрываем...' : 'Частично закрыть'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
