import {
  formatFilterChip,
  getFilterKey,
  type FilterDef,
  type UseFilterUrlStateResult,
} from '@sanity-labs/react-table-kit'
import {CloseIcon} from '@sanity/icons'
import {Button, Card, Flex, Text} from '@sanity/ui'

interface FilterChipRowProps {
  filterState: UseFilterUrlStateResult
  filters: FilterDef[]
}

export function FilterChipRow({filterState, filters}: FilterChipRowProps) {
  if (!filterState.hasActiveFilters) return null

  return (
    <Flex gap={2} wrap="wrap" align="center">
      {filters.map((filterDef) => {
        const key = getFilterKey(filterDef)
        const value = filterState.values[key]
        if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
          return null
        }

        return (
          <Card key={key} data-testid={`filter-chip-${key}`} padding={2} radius={2} tone="primary">
            <Flex align="center" gap={2}>
              <Text size={1}>{formatFilterChip(filterDef, value)}</Text>
              <Button
                data-testid={`filter-chip-remove-${key}`}
                fontSize={0}
                icon={CloseIcon}
                mode="bleed"
                onClick={() => filterState.clearFilter(filterDef)}
                padding={1}
              />
            </Flex>
          </Card>
        )
      })}
      <Button
        fontSize={1}
        mode="bleed"
        onClick={filterState.clearAll}
        padding={2}
        text="Clear all"
        tone="critical"
      />
    </Flex>
  )
}
