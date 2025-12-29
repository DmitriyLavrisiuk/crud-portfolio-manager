import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { createDeal } from '@/api/dealsApi'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toastError } from '@/lib/toast'
import { createDealSchema, type CreateDealFormValues } from '@/validation/deals'

type CreateDealDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

const defaultValues: CreateDealFormValues = {
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
}

const formatDateLabel = (value?: string) => {
  if (!value) return 'Выберите дату'
  return format(fromLocalDateIso(value), 'dd.MM.yyyy')
}

export default function CreateDealDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDealDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()

  const form = useForm<CreateDealFormValues>({
    resolver: zodResolver(createDealSchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      form.reset({
        ...defaultValues,
        openedAt: toLocalDateIso(new Date()),
      })
    }
  }, [open, form])

  const createMutation = useMutation({
    mutationFn: async (values: CreateDealFormValues) => {
      const payload = {
        symbol: values.symbol.trim().toUpperCase(),
        direction: values.direction,
        openedAt: toLocalDateIso(fromLocalDateIso(values.openedAt)),
        note: values.note?.trim() || undefined,
        entry: {
          qty: values.entry.qty,
          price: values.entry.price,
          fee: values.entry.fee || undefined,
          feeAsset: values.entry.feeAsset?.trim() || undefined,
        },
      }
      return createDeal(payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.('Сделка создана')
    },
    onError: (error) => {
      if (error instanceof Error) {
        toastError(`Ошибка создания: ${error.message}`)
        return
      }
      toastError('Ошибка создания: неизвестная ошибка')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать сделку</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            createMutation.mutate(values),
          )}
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deal-symbol">Символ</Label>
                <Input id="deal-symbol" {...form.register('symbol')} />
                {form.formState.errors.symbol && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.symbol.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-direction">Направление</Label>
                <Select
                  value={form.watch('direction')}
                  onValueChange={(value) =>
                    form.setValue(
                      'direction',
                      value as CreateDealFormValues['direction'],
                    )
                  }
                >
                  <SelectTrigger id="deal-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LONG">LONG</SelectItem>
                    <SelectItem value="SHORT">SHORT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Дата открытия</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal',
                        !form.watch('openedAt') && 'text-muted-foreground',
                      )}
                    >
                      {formatDateLabel(form.watch('openedAt'))}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        form.watch('openedAt')
                          ? fromLocalDateIso(form.watch('openedAt'))
                          : undefined
                      }
                      onSelect={(date: Date | undefined) =>
                        form.setValue(
                          'openedAt',
                          date
                            ? toLocalDateIso(date)
                            : form.getValues('openedAt'),
                          { shouldValidate: true, shouldDirty: true },
                        )
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.openedAt && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.openedAt.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Вход
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deal-entry-qty">Объем входа (qty)</Label>
                  <Input
                    id="deal-entry-qty"
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
                  <Label htmlFor="deal-entry-price">Цена входа</Label>
                  <Input
                    id="deal-entry-price"
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
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Label htmlFor="deal-entry-fee">Комиссия входа</Label>
                  <Input
                    id="deal-entry-fee"
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
                  <Label htmlFor="deal-entry-fee-asset">Актив</Label>
                  <Input
                    id="deal-entry-fee-asset"
                    {...form.register('entry.feeAsset')}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-note">Заметка</Label>
              <Input id="deal-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Сохраняем...' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
