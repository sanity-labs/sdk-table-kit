import {getFilterKey, type ReferenceFilterDef} from '@sanetti/sanity-table-kit'
import {SearchIcon} from '@sanity/icons'
import {useQuery} from '@sanity/sdk-react'
import {Button, Label, Stack, Text, TextInput} from '@sanity/ui'
import {useMemo, useState} from 'react'

import {
  buildReferenceProjection,
  getReferenceLabel,
  getReferencePreview,
} from '../../../helpers/filters/serverFilterBarUtils'
import {FilterPopover} from '../FilterPopover'
import type {BaseFilterControlProps} from './types'

export function ReferenceFilterControl({
  columns,
  filterDef,
  filterState,
}: BaseFilterControlProps<ReferenceFilterDef>) {
  const key = getFilterKey(filterDef)
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const effectivePreview = useMemo(
    () => getReferencePreview(filterDef, columns),
    [columns, filterDef],
  )
  const projection = useMemo(
    () =>
      buildReferenceProjection(
        effectivePreview ? {...filterDef, preview: effectivePreview} : filterDef,
      ),
    [effectivePreview, filterDef],
  )

  const {data, isPending} = useQuery<Array<Record<string, unknown>>>({
    query: `*[
      _type == $referenceType
      ${filterDef.options?.filter ? `&& (${filterDef.options.filter})` : ''}
      ${filterDef.options?.searchable !== false ? '&& (!defined($search) || title match $search)' : ''}
    ] | order(title asc)[0...$pageSize]${projection}`,
    params: {
      pageSize: filterDef.options?.pageSize ?? 20,
      referenceType: filterDef.referenceType,
      search: searchTerm ? `*${searchTerm}*` : null,
      ...(filterDef.options?.params ?? {}),
    },
  })

  const currentValue = filterState.values[key]
  const selectedIds = useMemo(
    () =>
      Array.isArray(currentValue)
        ? currentValue.map(String)
        : currentValue != null
          ? [String(currentValue)]
          : [],
    [currentValue],
  )

  const selectedLabel = useMemo(() => {
    if (selectedIds.length === 0) return 'Any'
    const match = data?.find((option) => selectedIds.includes(String(option._id)))
    if (match) return getReferenceLabel(filterDef, match, columns)
    return selectedIds.length === 1 ? selectedIds[0] : `${selectedIds.length} selected`
  }, [columns, data, filterDef, selectedIds])

  const applySelection = (optionId: string) => {
    if (filterDef.operator === 'in') {
      const nextValues = selectedIds.includes(optionId)
        ? selectedIds.filter((value) => value !== optionId)
        : [...selectedIds, optionId]
      filterState.setFilterValue(filterDef, nextValues.length > 0 ? nextValues : null)
      return
    }
    filterState.setFilterValue(filterDef, optionId)
    setOpen(false)
  }

  return (
    <Stack space={2}>
      <Label size={2} muted>
        {filterDef.label}
      </Label>
      <FilterPopover
        content={
          <Stack space={2}>
            {filterDef.options?.searchable !== false && (
              <TextInput
                icon={SearchIcon}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                placeholder="Search..."
                value={searchTerm}
              />
            )}
            <Stack space={1}>
              {isPending ? (
                <Text muted size={1}>
                  Loading...
                </Text>
              ) : !data || data.length === 0 ? (
                <Text muted size={1}>
                  No results
                </Text>
              ) : (
                data.map((option) => {
                  const optionId = String(option._id)
                  const selected = selectedIds.includes(optionId)
                  return (
                    <Button
                      key={optionId}
                      mode={selected ? 'default' : 'ghost'}
                      onClick={() => applySelection(optionId)}
                      text={getReferenceLabel(filterDef, option, columns)}
                      tone={selected ? 'primary' : 'default'}
                    />
                  )
                })
              )}
            </Stack>
          </Stack>
        }
        minWidth={240}
        open={open}
      >
        <Button
          aria-label={filterDef.label}
          data-testid={`filter-reference-trigger-${key}`}
          fontSize={1}
          mode={selectedIds.length > 0 ? 'default' : 'ghost'}
          onClick={() => setOpen((current) => !current)}
          padding={3}
          text={selectedLabel}
          tone={selectedIds.length > 0 ? 'primary' : 'default'}
        />
      </FilterPopover>
    </Stack>
  )
}
