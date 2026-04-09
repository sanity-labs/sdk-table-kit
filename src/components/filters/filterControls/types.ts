import type {FilterDef, UseFilterUrlStateResult} from '@sanity-labs/react-table-kit'

import type {SanityColumnDef} from '../../../hooks/useColumnProjection'

export interface BaseFilterControlProps<TFilterDef extends FilterDef = FilterDef> {
  columns?: SanityColumnDef[]
  filterDef: TFilterDef
  filterState: UseFilterUrlStateResult
}
