import {
  getFilterKey,
  type FilterDef,
  type FilterSurfaceTone,
  type UseFilterUrlStateResult,
} from '@sanity-labs/react-table-kit'
import {Card, Flex, Label, Select, Stack} from '@sanity/ui'
import type {CSSProperties, ReactNode} from 'react'

import type {SanityColumnDef} from '../../hooks/useColumnProjection'
import {FilterChipRow} from './FilterChipRow'
import {FilterControl} from './filterControls/FilterControl'

interface ServerFilterBarProps {
  filterState: UseFilterUrlStateResult
  filters: FilterDef[]
  columns?: SanityColumnDef[]
  groupableColumns?: string[]
  groupBy?: string | null
  onGroupByChange?: (groupBy: string | null) => void
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
  groupableColumns,
  groupBy,
  onGroupByChange,
  leading,
  searchLeading,
  surfaceTone = 'transparent',
  surfaceStyle,
  dockToTable = false,
}: ServerFilterBarProps) {
  const visibleFilters = filters.filter((filterDef) => !filterDef.hidden)
  const hasGroupBy = Boolean(groupableColumns && groupableColumns.length > 0 && onGroupByChange)
  const firstSearchFilter = searchLeading
    ? visibleFilters.find((filterDef) => filterDef.kind === 'search')
    : undefined
  const firstSearchFilterKey = firstSearchFilter ? getFilterKey(firstSearchFilter) : null
  const showControls =
    visibleFilters.length > 0 || Boolean(leading) || Boolean(searchLeading) || hasGroupBy
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
          {hasGroupBy && (
            <Stack space={2}>
              <Label size={2} muted>
                Group by
              </Label>
              <Select
                data-testid="group-by-select"
                value={groupBy ?? ''}
                onChange={(event) => onGroupByChange?.(event.currentTarget.value || null)}
                fontSize={1}
                padding={3}
              >
                <option value="">None</option>
                {groupableColumns!.map((columnId) => {
                  const column = columns?.find(
                    (candidate) => (candidate.field ?? candidate.id) === columnId,
                  )
                  return (
                    <option key={columnId} value={columnId}>
                      {column?.header ?? capitalize(columnId)}
                    </option>
                  )
                })}
              </Select>
            </Stack>
          )}
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

function capitalize(value: string): string {
  const cleaned = value.replace(/^_/, '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
