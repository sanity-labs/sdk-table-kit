import {
  getFilterKey,
  type FilterDef,
  type FilterSurfaceTone,
  type UseFilterUrlStateResult,
} from '@sanity-labs/react-table-kit'
import {Card, Flex, Stack} from '@sanity/ui'
import type {CSSProperties, ReactNode} from 'react'

import type {SanityColumnDef} from '../../hooks/useColumnProjection'
import {FilterChipRow} from './FilterChipRow'
import {FilterControl} from './filterControls/FilterControl'

interface ServerFilterBarProps {
  filterState: UseFilterUrlStateResult
  filters: FilterDef[]
  columns?: SanityColumnDef[]
  leading?: ReactNode
  searchLeading?: ReactNode
  surfaceTone?: FilterSurfaceTone
  surfaceStyle?: CSSProperties
  dockToTable?: boolean
}

export function ServerFilterBar({
  filterState,
  filters,
  columns,
  leading,
  searchLeading,
  surfaceTone = 'transparent',
  surfaceStyle,
  dockToTable = false,
}: ServerFilterBarProps) {
  const visibleFilters = filters.filter((filterDef) => !filterDef.hidden)
  const firstSearchFilter = searchLeading
    ? visibleFilters.find((filterDef) => filterDef.kind === 'search')
    : undefined
  const firstSearchFilterKey = firstSearchFilter ? getFilterKey(firstSearchFilter) : null
  const showControls = visibleFilters.length > 0 || Boolean(leading) || Boolean(searchLeading)
  const cardStyle: CSSProperties = {
    backgroundColor: 'var(--filter-surface-bg-color, var(--card-bg-color))',
    borderColor: 'var(--filter-surface-border-color, var(--card-border-color))',
    ...(dockToTable
      ? {
          borderBottom: 'none',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }
      : {}),
    ...surfaceStyle,
  }
  if (!showControls && !filterState.hasActiveFilters) return null

  return (
    <Card
      border
      data-testid="filter-surface"
      data-docked-to-table={dockToTable ? 'true' : 'false'}
      data-surface-tone={surfaceTone}
      paddingX={4}
      paddingY={3}
      radius={2}
      tone={surfaceTone}
      style={cardStyle}
    >
      <Stack space={3}>
        <Flex align="center" gap={4} wrap="wrap">
          {leading}
          {visibleFilters.map((filterDef) => {
            const filterKey = getFilterKey(filterDef)

            if (firstSearchFilterKey === filterKey) {
              return (
                <Flex
                  key={filterKey}
                  align="flex-end"
                  gap={4}
                  style={{marginLeft: 'auto'}}
                  wrap="wrap"
                >
                  {searchLeading}
                  <FilterControl
                    columns={columns}
                    filterDef={filterDef}
                    filterState={filterState}
                  />
                </Flex>
              )
            }

            return (
              <FilterControl
                columns={columns}
                filterDef={filterDef}
                filterState={filterState}
                key={filterKey}
              />
            )
          })}
          {!firstSearchFilterKey && searchLeading}
        </Flex>

        <FilterChipRow filterState={filterState} filters={visibleFilters} />
      </Stack>
    </Card>
  )
}
