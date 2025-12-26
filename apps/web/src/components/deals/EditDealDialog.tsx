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
        qty: deal.entry.qty,
        price: deal.entry.price,
        fee: deal.entry.fee ?? '',
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
      onOpenChange(false)
      onSuccess?.('Deal updated')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            updateMutation.mutate(values),
          )}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-deal-symbol">Symbol</Label>
              <Input id="edit-deal-symbol" {...form.register('symbol')} />
              {form.formState.errors.symbol && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.symbol.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-direction">Direction</Label>
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
              <Label htmlFor="edit-deal-opened-at">Opened At</Label>
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
              <Label htmlFor="edit-deal-entry-qty">Entry Qty</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-entry-price">Entry Price</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-deal-entry-fee">Entry Fee</Label>
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
              <Label htmlFor="edit-deal-entry-fee-asset">Entry Fee Asset</Label>
              <Input
                id="edit-deal-entry-fee-asset"
                {...form.register('entry.feeAsset')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-deal-note">Note</Label>
              <Input id="edit-deal-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          {updateMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {updateMutation.error.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
