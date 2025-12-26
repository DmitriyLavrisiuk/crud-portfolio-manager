import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { createDeal } from '@/api/dealsApi'
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
        openedAt: new Date().toISOString().slice(0, 10),
      })
    }
  }, [open, form])

  const createMutation = useMutation({
    mutationFn: async (values: CreateDealFormValues) => {
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
      return createDeal(payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.('Deal created')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Deal</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            createMutation.mutate(values),
          )}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deal-symbol">Symbol</Label>
              <Input id="deal-symbol" {...form.register('symbol')} />
              {form.formState.errors.symbol && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.symbol.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-direction">Direction</Label>
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
              <Label htmlFor="deal-opened-at">Opened At</Label>
              <Input
                id="deal-opened-at"
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
              <Label htmlFor="deal-entry-qty">Entry Qty</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-entry-price">Entry Price</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-entry-fee">Entry Fee</Label>
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
              <Label htmlFor="deal-entry-fee-asset">Entry Fee Asset</Label>
              <Input
                id="deal-entry-fee-asset"
                {...form.register('entry.feeAsset')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="deal-note">Note</Label>
              <Input id="deal-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          {createMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
