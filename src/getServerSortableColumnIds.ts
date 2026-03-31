import type {ColumnDef} from '@sanetti/sanity-table-kit'

export function getServerSortableColumnIds(columns: ColumnDef[]): string[] {
  return columns
    .filter((column) => {
      const maybeColumn = column as ColumnDef & {projection?: string}

      if (column.sortable === false) return false
      if (!column.field) return false
      if (column.sortValue) return false

      return !maybeColumn.projection || maybeColumn.projection === column.field
    })
    .map((column) => column.id)
}
