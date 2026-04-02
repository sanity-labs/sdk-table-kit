import {getFilterKey, type SearchFilterDef} from '@sanetti/sanity-table-kit'
import {SearchIcon} from '@sanity/icons'
import {Label, Stack, TextInput} from '@sanity/ui'
import {useEffect, useState} from 'react'

import type {BaseFilterControlProps} from './types'

export function SearchFilterControl({
  filterDef,
  filterState,
}: BaseFilterControlProps<SearchFilterDef>) {
  const key = getFilterKey(filterDef)
  const committedValue = String(filterState.values[key] ?? '')
  const [draftValue, setDraftValue] = useState(committedValue)

  useEffect(() => {
    setDraftValue(committedValue)
  }, [committedValue])

  useEffect(() => {
    const timer = setTimeout(() => {
      filterState.setFilterValue(filterDef, draftValue || null)
    }, filterDef.debounceMs ?? 300)
    return () => clearTimeout(timer)
  }, [draftValue, filterDef, filterState])

  return (
    <Stack space={2} style={{marginLeft: 'auto'}}>
      <Label size={2} muted>
        {filterDef.label}
      </Label>
      <TextInput
        fontSize={1}
        icon={SearchIcon}
        onChange={(event) => setDraftValue(event.currentTarget.value)}
        padding={3}
        placeholder={filterDef.placeholder ?? 'Search...'}
        style={{minWidth: 200, flex: '1 1 200px'}}
        value={draftValue}
      />
    </Stack>
  )
}
