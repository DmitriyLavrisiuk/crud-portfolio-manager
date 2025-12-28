import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { addEntryLeg } from '@/api/dealsApi'
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
import {
  addEntryLegSchema,
  type AddEntryLegFormValues,
} from '@/validation/deals'

type AddEntryLegDialogProps = {
  deal: Deal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

export default function AddEntryLegDialog({
  deal,
  open,
  onOpenChange,
  onSuccess,
}: AddEntryLegDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()

  const form = useForm<AddEntryLegFormValues>({
    resolver: zodResolver(addEntryLegSchema),
    defaultValues: {
      openedAt: new Date().toISOString().slice(0, 10),
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
    if (!open) return
    form.reset({
      openedAt: new Date().toISOString().slice(0, 10),
      entry: {
        qty: '',
        price: '',
        fee: undefined,
        feeAsset: '',
      },
      note: '',
    })
  }, [open, form])

  const addMutation = useMutation({
    mutationFn: async (values: AddEntryLegFormValues) => {
      if (!deal) {
        throw new Error('No deal selected')
      }
      const payload = {
        openedAt: values.openedAt
          ? new Date(values.openedAt).toISOString()
          : undefined,
        entry: {
          qty: values.entry.qty,
          price: values.entry.price,
          fee: values.entry.fee || undefined,
          feeAsset: values.entry.feeAsset?.trim() || undefined,
        },
        note: values.note?.trim() || undefined,
      }
      return addEntryLeg(deal.id, payload, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onSuccess?.('Entry leg added')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Entry (DCA)</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-entry-date">Opened At</Label>
              <Input
                id="add-entry-date"
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
              <Label htmlFor="add-entry-qty">Entry Qty</Label>
              <Input
                id="add-entry-qty"
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
              <Label htmlFor="add-entry-price">Entry Price</Label>
              <Input
                id="add-entry-price"
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
              <Label htmlFor="add-entry-fee">Entry Fee</Label>
              <Input
                id="add-entry-fee"
                inputMode="decimal"
                {...form.register('entry.fee')}
              />
              {form.formState.errors.entry?.fee && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.entry.fee.message}
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="add-entry-fee-asset">Entry Fee Asset</Label>
              <Input
                id="add-entry-fee-asset"
                {...form.register('entry.feeAsset')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="add-entry-note">Note</Label>
              <Input id="add-entry-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          {addMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {addMutation.error.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Saving...' : 'Add entry'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
