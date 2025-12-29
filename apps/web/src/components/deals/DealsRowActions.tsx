import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthProvider'
import { deleteDeal } from '@/api/dealsApi'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { toastError, toastSuccess } from '@/lib/toast'
import { type Deal } from '@/types/deals'

type DealsRowActionsProps = {
  deal: Deal
  onImportEntry: (deal: Deal) => void
  onImportExit: (deal: Deal) => void
  onEdit: (deal: Deal) => void
  onAddEntry: (deal: Deal) => void
  onProfitToPosition: (deal: Deal) => void
  onPartialClose: (deal: Deal) => void
  onClose: (deal: Deal) => void
  onCloseWithOrder: (deal: Deal) => void
  onDeleted?: (dealId: string) => void
}

export default function DealsRowActions({
  deal,
  onImportEntry,
  onImportExit,
  onEdit,
  onAddEntry,
  onProfitToPosition,
  onPartialClose,
  onClose,
  onCloseWithOrder,
  onDeleted,
}: DealsRowActionsProps) {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [openDelete, setOpenDelete] = useState(false)
  const isClosed = deal.status === 'CLOSED'
  const dealId = deal.id

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteDeal(dealId, {
        accessToken,
        onUnauthorized: refresh,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['dealsStats'] })
      setOpenDelete(false)
      onDeleted?.(dealId)
      toastSuccess('Сделка удалена')
    },
    onError: (error) => {
      if (error instanceof Error) {
        toastError(`Ошибка удаления: ${error.message}`)
        return
      }
      toastError('Ошибка удаления: неизвестная ошибка')
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Открыть меню действий"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onImportEntry(deal)}>
              Импорт входа
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onImportExit(deal)}>
              Импорт выхода
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onEdit(deal)}>
              Редактировать
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAddEntry(deal)}
              disabled={isClosed}
            >
              Добавить вход (DCA)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onProfitToPosition(deal)}
              disabled={isClosed}
            >
              Реинвестировать прибыль
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onPartialClose(deal)}
              disabled={isClosed}
            >
              Частичное закрытие
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onClose(deal)} disabled={isClosed}>
              Закрыть
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onCloseWithOrder(deal)}
              disabled={isClosed}
            >
              Закрыть через ордер
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setOpenDelete(true)
            }}
            className="text-destructive focus:text-destructive"
          >
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
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
    </>
  )
}
