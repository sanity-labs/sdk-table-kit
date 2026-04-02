import type {FilterDef, UseFilterUrlStateResult} from '@sanetti/sanity-table-kit'

import type {SanityColumnDef} from '../../../hooks/useColumnProjection'

export interface BaseFilterControlProps<TFilterDef extends FilterDef = FilterDef> {
  columns?: SanityColumnDef[]
  filterDef: TFilterDef
  filterState: UseFilterUrlStateResult
}
