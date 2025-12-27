import { useEffect, useMemo, useState } from 'react'
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
  const [warning, setWarning] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const closeSide = getCloseSide(deal)

  const form = useForm<CloseWithOrderFormValues>({
    resolver: zodResolver(closeWithOrderSchema),
    defaultValues: {
      closeSide,
      marketBuyMode: closeSide === 'BUY' ? 'BASE' : undefined,
      quantity: deal.entry?.qty ?? '',
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
      quantity: deal.entry?.qty ?? '',
      quoteOrderQty: '',
      note: '',
    })
    setWarning(null)
    setErrorMessage(null)
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
      onSuccess?.('Deal closed via market order')
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
        setWarning('fills ещё не доступны, попробуй позже')
        setErrorMessage(null)
        return
      }
      setWarning(null)
      setErrorMessage(message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Close with order</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Close side</Label>
              <Input value={closeSide} readOnly />
            </div>
            {closeSide === 'BUY' && (
              <div className="space-y-2">
                <Label htmlFor="close-order-buy-mode">Buy mode</Label>
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
              </div>
            )}
            {(closeSide === 'SELL' || marketBuyMode === 'BASE') && (
              <div className="space-y-2">
                <Label htmlFor="close-order-qty">Quantity</Label>
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
                <Label htmlFor="close-order-quote">Quote amount</Label>
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
              <Label htmlFor="close-order-note">Note</Label>
              <Input id="close-order-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          {warning && (
            <p className="text-sm text-amber-600" role="alert">
              {warning}
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!form.formState.isValid || mutation.isPending}
            >
              {mutation.isPending ? 'Submitting...' : 'Close with order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
