import {getFilterKey, type FilterDef} from '@sanity-labs/react-table-kit'
import {Button, Label, Menu, MenuButton, MenuItem, Stack, Text} from '@sanity/ui'
import {useState} from 'react'

import {FilterPopover} from '../FilterPopover'
import type {BaseFilterControlProps} from './types'

export function SingleSelectFilterControl({
  filterDef,
  filterState,
}: BaseFilterControlProps<Extract<FilterDef, {kind: 'string' | 'boolean' | 'number'}>>) {
  const key = getFilterKey(filterDef)
  const currentValue = filterState.values[key]
  const options =
    filterDef.kind === 'boolean'
      ? [
          {label: 'True', value: true},
          {label: 'False', value: false},
        ]
      : (filterDef.options ?? [])

  const displayText = (() => {
    if (currentValue == null || currentValue === '') return 'Any'
    if (typeof currentValue === 'boolean') return currentValue ? 'True' : 'False'
    return String(currentValue)
  })()

  return (
    <Stack space={2}>
      <Label size={2} muted>
        {filterDef.label}
      </Label>
      <MenuButton
        button={
          <Button
            aria-label={filterDef.label}
            fontSize={1}
            mode={currentValue != null && currentValue !== '' ? 'default' : 'ghost'}
            padding={3}
            text={displayText}
            tone={currentValue != null && currentValue !== '' ? 'primary' : 'default'}
          />
        }
        id={`filter-${key}`}
        menu={
          <Menu>
            {currentValue != null && currentValue !== '' && (
              <MenuItem onClick={() => filterState.clearFilter(filterDef)} text="Any" />
            )}
            {options.map((option) => (
              <MenuItem
                key={String(option.value)}
                onClick={() => filterState.setFilterValue(filterDef, option.value)}
                pressed={option.value === currentValue}
                text={option.label}
                tone={option.value === currentValue ? 'primary' : 'default'}
              />
            ))}
          </Menu>
        }
        popover={{portal: false}}
      />
    </Stack>
  )
}

export function MultiSelectFilterControl({
  filterDef,
  filterState,
}: BaseFilterControlProps<Extract<FilterDef, {kind: 'string'}>>) {
  const key = getFilterKey(filterDef)
  const [open, setOpen] = useState(false)
  const currentValue = (filterState.values[key] as string[] | null) ?? []
  const options = filterDef.options ?? []
  const label =
    currentValue.length === 0
      ? 'Any'
      : currentValue.length === 1
        ? currentValue[0]
        : `${currentValue.length} selected`

  const toggleValue = (optionValue: string) => {
    const nextValues = currentValue.includes(optionValue)
      ? currentValue.filter((value) => value !== optionValue)
      : [...currentValue, optionValue]
    filterState.setFilterValue(filterDef, nextValues.length > 0 ? nextValues : null)
  }

  return (
    <Stack space={2}>
      <Label size={2} muted>
        {filterDef.label}
      </Label>
      <FilterPopover
        animate
        content={
          <Stack space={1}>
            {options.length === 0 ? (
              <Text muted size={1}>
                No options
              </Text>
            ) : (
              options.map((option) => (
                <Button
                  key={option.value}
                  mode={currentValue.includes(option.value) ? 'default' : 'ghost'}
                  onClick={() => toggleValue(option.value)}
                  text={option.label}
                  tone={currentValue.includes(option.value) ? 'primary' : 'default'}
                />
              ))
            )}
          </Stack>
        }
        open={open}
      >
        <Button
          aria-label={filterDef.label}
          data-testid={`filter-multiselect-trigger-${key}`}
          fontSize={1}
          mode={currentValue.length > 0 ? 'default' : 'ghost'}
          onClick={() => setOpen((current) => !current)}
          padding={3}
          text={label}
          tone={currentValue.length > 0 ? 'primary' : 'default'}
        />
      </FilterPopover>
    </Stack>
  )
}
