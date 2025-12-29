import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { openDealWithOrder } from '@/api/dealsApi'
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
import { type DealsListFilters } from '@/api/dealsApi'
import { toastError, toastWarning } from '@/lib/toast'
import {
  openWithOrderSchema,
  type OpenWithOrderFormValues,
} from '@/validation/deals'

type OpenWithOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
  queryFilters: DealsListFilters
}

const defaultValues: OpenWithOrderFormValues = {
  symbol: '',
  direction: 'LONG',
  marketBuyMode: 'QUOTE',
  quoteOrderQty: '',
  quantity: '',
  note: '',
}

export default function OpenWithOrderDialog({
  open,
  onOpenChange,
  onSuccess,
  queryFilters,
}: OpenWithOrderDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()

  const form = useForm<OpenWithOrderFormValues>({
    resolver: zodResolver(openWithOrderSchema),
    defaultValues,
    mode: 'onChange',
  })

  const direction = form.watch('direction')
  const marketBuyMode = form.watch('marketBuyMode')
  const isBuy = direction === 'LONG'
  const symbolField = form.register('symbol')

  useEffect(() => {
    if (!open) return
    form.reset(defaultValues)
  }, [open, form])

  const dealsQueryKey = useMemo(() => ['deals', queryFilters], [queryFilters])
  const statsQueryKey = useMemo(
    () => ['dealsStats', queryFilters],
    [queryFilters],
  )

  const mutation = useMutation({
    mutationFn: async (values: OpenWithOrderFormValues) => {
      const payload = {
        symbol: values.symbol.trim().toUpperCase(),
        direction: values.direction,
        marketBuyMode: isBuy ? values.marketBuyMode : undefined,
        quoteOrderQty: values.quoteOrderQty?.trim() || undefined,
        quantity: values.quantity?.trim() || undefined,
        note: values.note?.trim() || undefined,
      }
      return openDealWithOrder(payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealsQueryKey })
      queryClient.invalidateQueries({ queryKey: statsQueryKey })
      onOpenChange(false)
      onSuccess?.('Сделка открыта через рыночный ордер')
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
            : 'Failed to open deal'
      if (
        data?.statusCode === 409 &&
        message.toLowerCase().includes('no fills')
      ) {
        toastWarning(
          'Ордер создан, но fills ещё не доступны. Попробуй ещё раз через 2–5 сек.',
        )
        return
      }
      toastError(`Ошибка открытия: ${message}`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Открыть через ордер</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="open-order-symbol">Символ</Label>
              <Input
                id="open-order-symbol"
                value={form.watch('symbol')}
                onChange={(event) =>
                  form.setValue('symbol', event.target.value.toUpperCase(), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                onBlur={symbolField.onBlur}
                name={symbolField.name}
                ref={symbolField.ref}
              />
              {form.formState.errors.symbol && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.symbol.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="open-order-direction">Направление</Label>
              <Select
                value={direction}
                onValueChange={(value) =>
                  form.setValue(
                    'direction',
                    value as OpenWithOrderFormValues['direction'],
                    { shouldValidate: true },
                  )
                }
              >
                <SelectTrigger id="open-order-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LONG">LONG</SelectItem>
                  <SelectItem value="SHORT">SHORT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isBuy && (
              <div className="space-y-2">
                <Label htmlFor="open-order-buy-mode">Режим покупки</Label>
                <Select
                  value={marketBuyMode ?? 'QUOTE'}
                  onValueChange={(value) =>
                    form.setValue(
                      'marketBuyMode',
                      value as OpenWithOrderFormValues['marketBuyMode'],
                      { shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger id="open-order-buy-mode">
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
            {isBuy && marketBuyMode === 'QUOTE' && (
              <div className="space-y-2">
                <Label htmlFor="open-order-quote">Сумма в quote</Label>
                <Input
                  id="open-order-quote"
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
            {((isBuy && marketBuyMode === 'BASE') || !isBuy) && (
              <div className="space-y-2">
                <Label htmlFor="open-order-qty">Количество</Label>
                <Input
                  id="open-order-qty"
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="open-order-note">Заметка</Label>
              <Input id="open-order-note" {...form.register('note')} />
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
              {mutation.isPending ? 'Отправляем...' : 'Открыть через ордер'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
