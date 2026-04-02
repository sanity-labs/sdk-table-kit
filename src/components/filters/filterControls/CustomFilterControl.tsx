import {getFilterKey, type FilterDef} from '@sanetti/sanity-table-kit'
import {Button, Label, Stack} from '@sanity/ui'
import {useState} from 'react'

import {FilterPopover} from '../FilterPopover'
import type {BaseFilterControlProps} from './types'

export function CustomFilterControl({
  filterDef,
  filterState,
}: BaseFilterControlProps<Extract<FilterDef, {kind: 'custom'}>>) {
  const key = getFilterKey(filterDef)
  const [open, setOpen] = useState(false)
  const value = (filterState.values[key] as unknown) ?? null

  if (!filterDef.component) {
    return (
      <Stack space={2}>
        <Label size={2} muted>
          {filterDef.label}
        </Label>
        <Button fontSize={1} mode="ghost" padding={3} text="Custom filter" />
      </Stack>
    )
  }

  const Component = filterDef.component

  return (
    <Stack space={2}>
      <Label size={2} muted>
        {filterDef.label}
      </Label>
      <FilterPopover
        content={
          <Component
            onApply={() => setOpen(false)}
            onChange={(nextValue) => filterState.setFilterValue(filterDef, nextValue)}
            onClear={() => filterState.clearFilter(filterDef)}
            value={value}
          />
        }
        open={open}
      >
        <Button
          aria-label={filterDef.label}
          data-testid={`filter-custom-trigger-${key}`}
          fontSize={1}
          mode={value != null ? 'default' : 'ghost'}
          onClick={() => setOpen((current) => !current)}
          padding={3}
          text={value != null ? filterDef.formatChip(value) : 'Any'}
          tone={value != null ? 'primary' : 'default'}
        />
      </FilterPopover>
    </Stack>
  )
}
