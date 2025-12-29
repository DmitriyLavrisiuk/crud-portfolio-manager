import type { RowData } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string
    cellClassName?: string
    sizeClassName?: string
    __types?: {
      data: TData
      value: TValue
    }
  }
}

export {}
