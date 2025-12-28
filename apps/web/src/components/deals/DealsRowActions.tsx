import { MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onDelete: (deal: Deal) => void
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
  onDelete,
}: DealsRowActionsProps) {
  const isClosed = deal.status === 'CLOSED'

  return (
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
          onClick={() => onDelete(deal)}
          className="text-destructive focus:text-destructive"
        >
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
