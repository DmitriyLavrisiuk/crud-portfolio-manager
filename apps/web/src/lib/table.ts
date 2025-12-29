import {
  getCoreRowModel,
  type TableOptions,
  useReactTable,
} from '@tanstack/react-table'

export function useAppTable<TData>(
  options: Omit<TableOptions<TData>, 'getCoreRowModel'>,
) {
  return useReactTable({
    ...options,
    getCoreRowModel: getCoreRowModel(),
  })
}
