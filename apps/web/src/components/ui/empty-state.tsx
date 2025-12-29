import { Inbox } from 'lucide-react'

type EmptyStateProps = {
  title: string
  description?: string
  className?: string
}

export default function EmptyState({
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center ${className ?? ''}`}
    >
      <Inbox className="h-6 w-6 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
