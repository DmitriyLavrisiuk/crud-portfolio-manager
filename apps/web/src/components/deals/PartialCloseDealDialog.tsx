import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { partialCloseDeal } from '@/api/dealsApi'
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
      closedAt: new Date().toISOString().slice(0, 10),
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
      closedAt: new Date().toISOString().slice(0, 10),
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
          ? new Date(values.closedAt).toISOString()
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
      onSuccess?.('Deal partially closed')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Partial Close</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => closeMutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="partial-close-date">Closed At</Label>
              <Input
                id="partial-close-date"
                type="date"
                {...form.register('closedAt')}
              />
              {form.formState.errors.closedAt && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.closedAt.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="partial-close-exit-qty">Exit Qty</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="partial-close-exit-price">Exit Price</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="partial-close-exit-fee">Exit Fee</Label>
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="partial-close-exit-fee-asset">
                Exit Fee Asset
              </Label>
              <Input
                id="partial-close-exit-fee-asset"
                {...form.register('exit.feeAsset')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="partial-close-note">Note</Label>
              <Input id="partial-close-note" {...form.register('note')} />
              {form.formState.errors.note && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
          </div>

          {closeMutation.error instanceof Error && (
            <p className="text-sm text-destructive">
              {closeMutation.error.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={closeMutation.isPending}>
              {closeMutation.isPending ? 'Closing...' : 'Partial close'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
