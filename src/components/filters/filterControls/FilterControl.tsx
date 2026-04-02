import {getFilterControl, type FilterDef} from '@sanetti/sanity-table-kit'

import {CustomFilterControl} from './CustomFilterControl'
import {DateFilterControl} from './DateFilterControl'
import {ReferenceFilterControl} from './ReferenceFilterControl'
import {SearchFilterControl} from './SearchFilterControl'
import {MultiSelectFilterControl, SingleSelectFilterControl} from './SelectFilterControls'
import type {BaseFilterControlProps} from './types'

export function FilterControl({
  columns,
  filterDef,
  filterState,
}: BaseFilterControlProps<FilterDef>) {
  const control = getFilterControl(filterDef)

  if (filterDef.kind === 'search') {
    return <SearchFilterControl filterDef={filterDef} filterState={filterState} />
  }

  if (filterDef.kind === 'date') {
    return <DateFilterControl filterDef={filterDef} filterState={filterState} />
  }

  if (filterDef.kind === 'reference') {
    return (
      <ReferenceFilterControl columns={columns} filterDef={filterDef} filterState={filterState} />
    )
  }

  if (filterDef.kind === 'custom') {
    return <CustomFilterControl filterDef={filterDef} filterState={filterState} />
  }

  if (control === 'multiSelect' && filterDef.kind === 'string') {
    return <MultiSelectFilterControl filterDef={filterDef} filterState={filterState} />
  }

  return <SingleSelectFilterControl filterDef={filterDef} filterState={filterState} />
}
