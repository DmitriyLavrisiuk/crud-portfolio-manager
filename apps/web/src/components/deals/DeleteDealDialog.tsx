import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { deleteDeal } from '@/api/dealsApi'
import { toastError } from '@/lib/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
type DeleteDealDialogProps = {
  dealId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
  onDeleted?: (id: string) => void
}

export default function DeleteDealDialog({
  dealId,
  open,
  onOpenChange,
  onSuccess,
  onDeleted,
}: DeleteDealDialogProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!dealId) {
        onOpenChange(false)
        throw new Error('MISSING_DEAL')
      }
      return deleteDeal(dealId, {
        accessToken,
        onUnauthorized: refresh,
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      onOpenChange(false)
      onDeleted?.(result.id)
      onSuccess?.('Сделка удалена')
    },
    onError: (error) => {
      if (!(error instanceof Error)) {
        toastError('Ошибка удаления: неизвестная ошибка')
        return
      }
      if (error.message === 'MISSING_DEAL') {
        toastError('Не удалось определить сделку для удаления')
        return
      }
      toastError(`Ошибка удаления: ${error.message}`)
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить сделку?</AlertDialogTitle>
          <AlertDialogDescription>
            Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Удаляем...' : 'Удалить'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
