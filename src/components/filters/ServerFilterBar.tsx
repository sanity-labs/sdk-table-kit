import {
  getFilterKey,
  type FilterDef,
  type UseFilterUrlStateResult,
} from '@sanity-labs/react-table-kit'
import {Flex, Stack} from '@sanity/ui'

import type {SanityColumnDef} from '../../hooks/useColumnProjection'
import {FilterChipRow} from './FilterChipRow'
import {FilterControl} from './filterControls/FilterControl'

interface ServerFilterBarProps {
  filterState: UseFilterUrlStateResult
  filters: FilterDef[]
  columns?: SanityColumnDef[]
}

export function ServerFilterBar({filterState, filters, columns}: ServerFilterBarProps) {
  const visibleFilters = filters.filter((filterDef) => !filterDef.hidden)
  if (visibleFilters.length === 0) return null

  return (
    <Stack marginBottom={3} space={3}>
      <Flex align="center" gap={4} wrap="wrap">
        {visibleFilters.map((filterDef) => (
          <FilterControl
            columns={columns}
            filterDef={filterDef}
            filterState={filterState}
            key={getFilterKey(filterDef)}
          />
        ))}
      </Flex>

      <FilterChipRow filterState={filterState} filters={visibleFilters} />
    </Stack>
  )
}
