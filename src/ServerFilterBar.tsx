import {
  CalendarPopoverContent,
  formatDateOnlyString,
  formatFilterChip,
  getFilterControl,
  getFilterKey,
  parseDateOnlyString,
  type FilterDef,
  type ReferenceFilterDef,
  type SearchFilterDef,
} from '@sanetti/sanity-table-kit'
import type {UseFilterUrlStateResult} from '@sanetti/sanity-table-kit'
import {CalendarIcon, CloseIcon, SearchIcon} from '@sanity/icons'
import {useQuery} from '@sanity/sdk-react'
import {
  Button,
  Card,
  Flex,
  Label,
  Menu,
  MenuButton,
  MenuItem,
  Popover,
  Stack,
  Text,
  TextInput,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import type {KeyboardEvent as ReactKeyboardEvent} from 'react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {DayPicker, type DateRange} from 'react-day-picker'

import type {SanityColumnDef} from './useColumnProjection'

interface ServerFilterBarProps {
  filterState: UseFilterUrlStateResult
  filters: FilterDef[]
  columns?: SanityColumnDef[]
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

export function ServerFilterBar({filterState, filters, columns}: ServerFilterBarProps) {
  const visibleFilters = filters.filter((filterDef) => !filterDef.hidden)
  if (visibleFilters.length === 0) return null

  return (
    <Stack space={3}>
      <Flex gap={4} wrap="wrap" align="center">
        {visibleFilters.map((filterDef) => (
          <FilterControl
            key={getFilterKey(filterDef)}
            filterDef={filterDef}
            filterState={filterState}
            columns={columns}
          />
        ))}
      </Flex>

      {filterState.hasActiveFilters && (
        <Flex gap={2} wrap="wrap" align="center">
          {visibleFilters.map((filterDef) => {
            const key = getFilterKey(filterDef)
            const value = filterState.values[key]
            if (value == null || value === '' || (Array.isArray(value) && value.length === 0))
              return null

            return (
              <Card
                key={key}
                data-testid={`filter-chip-${key}`}
                padding={2}
                radius={2}
                tone="primary"
              >
                <Flex align="center" gap={2}>
                  <Text size={1}>{formatFilterChip(filterDef, value)}</Text>
                  <Button
                    data-testid={`filter-chip-remove-${key}`}
                    icon={CloseIcon}
                    mode="bleed"
                    onClick={() => filterState.clearFilter(filterDef)}
                    padding={1}
                    fontSize={0}
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
      )}
    </Stack>
  )
}

function FilterControl({
  filterDef,
  filterState,
  columns,
}: {
  filterDef: FilterDef
  filterState: UseFilterUrlStateResult
  columns?: SanityColumnDef[]
}) {
  const control = getFilterControl(filterDef)

  if (filterDef.kind === 'search') {
    return <SearchFilterControl filterDef={filterDef} filterState={filterState} />
  }

  if (filterDef.kind === 'date') {
    return <DateFilterControl filterDef={filterDef} filterState={filterState} />
  }

  if (filterDef.kind === 'reference') {
    return (
      <ReferenceFilterControl filterDef={filterDef} filterState={filterState} columns={columns} />
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

function SearchFilterControl({
  filterDef,
  filterState,
}: {
  filterDef: SearchFilterDef
  filterState: UseFilterUrlStateResult
}) {
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
    <Stack space={2} className="max-w-sm">
      <Label size={2} muted>
        {filterDef.label}
      </Label>
      <TextInput
        icon={SearchIcon}
        placeholder={filterDef.placeholder ?? 'Search...'}
        value={draftValue}
        onChange={(event) => setDraftValue(event.currentTarget.value)}
        fontSize={1}
        padding={3}
        style={{minWidth: 200, flex: '1 1 200px'}}
      />
    </Stack>
  )
}

function DateFilterControl({
  filterDef,
  filterState,
}: {
  filterDef: Extract<FilterDef, {kind: 'date'}>
  filterState: UseFilterUrlStateResult
}) {
  const key = getFilterKey(filterDef)
  const committedValue = filterState.values[key] as {from?: string; to?: string} | string | null
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const committedRange = useMemo(() => {
    if (filterDef.operator === 'range' && committedValue && typeof committedValue === 'object') {
      const range = committedValue as {from?: string; to?: string}
      return {
        from: parseDateOnlyString(range.from),
        to: parseDateOnlyString(range.to),
      }
    }
    const single =
      typeof committedValue === 'string' ? parseDateOnlyString(committedValue) : undefined
    return single ? {from: single, to: single} : undefined
  }, [committedValue, filterDef.operator])

  const [draftRange, setDraftRange] = useState<DateRange | undefined>(committedRange)

  useEffect(() => {
    setDraftRange(committedRange)
  }, [committedRange])

  const closePopover = useCallback(() => {
    setOpen(false)
    setDraftRange(committedRange)
  }, [committedRange])

  useClickOutsideEvent(open ? closePopover : undefined, () => [
    popoverRef.current,
    triggerRef.current,
  ])
  useGlobalKeyDown((event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    closePopover()
  })

  const handleSelect = useCallback(
    (nextRange: DateRange | undefined) => {
      if (filterDef.operator === 'range' && !draftRange?.from && nextRange?.from && nextRange.to) {
        if (isSameCalendarDay(nextRange.from, nextRange.to)) {
          setDraftRange({from: nextRange.from, to: undefined})
          return
        }
      }

      setDraftRange(nextRange)

      if (filterDef.operator === 'range') {
        if (!nextRange?.from || !nextRange.to) return
        filterState.setFilterValue(filterDef, {
          from: formatDateOnlyString(nextRange.from),
          to: formatDateOnlyString(nextRange.to),
        })
        setOpen(false)
        return
      }

      if (!nextRange?.from) return
      filterState.setFilterValue(filterDef, formatDateOnlyString(nextRange.from))
      setOpen(false)
    },
    [draftRange?.from, filterDef, filterState],
  )

  const displayText = (() => {
    if (filterDef.operator === 'range') {
      const range = committedValue as {from?: string; to?: string} | null
      if (range?.from && range?.to) {
        return `${formatShortDate(parseDateOnlyString(range.from)!)} → ${formatShortDate(parseDateOnlyString(range.to)!)}`
      }
      return 'Any date'
    }
    if (typeof committedValue === 'string') {
      const date = parseDateOnlyString(committedValue)
      return date ? formatShortDate(date) : 'Any date'
    }
    return 'Any date'
  })()

  return (
    <Stack space={2}>
      <Label size={2} muted>
        {filterDef.label}
      </Label>
      <Popover
        content={
          <CalendarPopoverContent
            onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              closePopover()
            }}
            popoverRef={popoverRef}
          >
            {filterDef.operator === 'range' ? (
              <DayPicker
                mode="range"
                selected={draftRange}
                onSelect={handleSelect}
                defaultMonth={draftRange?.from ?? committedRange?.from}
                numberOfMonths={1}
                showOutsideDays
              />
            ) : (
              <DayPicker
                mode="single"
                selected={draftRange?.from}
                onSelect={(date) => handleSelect(date ? {from: date, to: date} : undefined)}
                defaultMonth={draftRange?.from ?? committedRange?.from}
                numberOfMonths={1}
                showOutsideDays
              />
            )}
          </CalendarPopoverContent>
        }
        open={open}
        placement="bottom-start"
        portal
      >
        <div ref={triggerRef}>
          <Button
            aria-label={filterDef.label}
            data-testid={`filter-date-trigger-${key}`}
            fontSize={1}
            iconRight={CalendarIcon}
            mode={committedValue ? 'default' : 'ghost'}
            onClick={() => setOpen((current) => !current)}
            padding={3}
            text={displayText}
            tone={committedValue ? 'primary' : 'default'}
          />
        </div>
      </Popover>
    </Stack>
  )
}

function SingleSelectFilterControl({
  filterDef,
  filterState,
}: {
  filterDef: Extract<FilterDef, {kind: 'string' | 'boolean' | 'number'}>
  filterState: UseFilterUrlStateResult
}) {
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
        id={`filter-${key}`}
        button={
          <Button
            fontSize={1}
            mode={currentValue != null && currentValue !== '' ? 'default' : 'ghost'}
            padding={3}
            text={displayText}
            tone={currentValue != null && currentValue !== '' ? 'primary' : 'default'}
            aria-label={filterDef.label}
          />
        }
        menu={
          <Menu>
            {currentValue != null && currentValue !== '' && (
              <MenuItem text="Any" onClick={() => filterState.clearFilter(filterDef)} />
            )}
            {options.map((option) => (
              <MenuItem
                key={String(option.value)}
                text={option.label}
                pressed={option.value === currentValue}
                tone={option.value === currentValue ? 'primary' : 'default'}
                onClick={() => filterState.setFilterValue(filterDef, option.value)}
              />
            ))}
          </Menu>
        }
        popover={{portal: false}}
      />
    </Stack>
  )
}

function MultiSelectFilterControl({
  filterDef,
  filterState,
}: {
  filterDef: Extract<FilterDef, {kind: 'string'}>
  filterState: UseFilterUrlStateResult
}) {
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
      <Popover
        content={
          <Card padding={2} radius={3}>
            <Stack space={1}>
              {options.length === 0 ? (
                <Text size={1} muted>
                  No options
                </Text>
              ) : (
                options.map((option) => (
                  <Button
                    key={option.value}
                    mode={currentValue.includes(option.value) ? 'default' : 'ghost'}
                    text={option.label}
                    tone={currentValue.includes(option.value) ? 'primary' : 'default'}
                    onClick={() => toggleValue(option.value)}
                  />
                ))
              )}
            </Stack>
          </Card>
        }
        open={open}
        placement="bottom-start"
        portal
        animate
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
      </Popover>
    </Stack>
  )
}

function buildReferenceProjection(filterDef: ReferenceFilterDef): string {
  if (!filterDef.preview) return '{_id, title}'
  const parts = Object.entries(filterDef.preview.select).map(([key, path]) =>
    key === path && !path.includes('.') && !path.includes('[') ? key : `"${key}": ${path}`,
  )
  if (!filterDef.preview.select._id) parts.push('_id')
  return `{${parts.join(', ')}}`
}

function getReferencePreview(filterDef: ReferenceFilterDef, columns?: SanityColumnDef[]) {
  if (filterDef.preview) return filterDef.preview
  return columns?.find((column) => column.field === filterDef.field)?._referencePreview
}

function getReferenceLabel(
  filterDef: ReferenceFilterDef,
  option: Record<string, unknown>,
  columns?: SanityColumnDef[],
): string {
  const preview = getReferencePreview(filterDef, columns)
  if (!preview) {
    return String(option.title ?? option._id ?? '')
  }
  const prepared = preview.prepare(option)
  return String(prepared.title ?? option._id ?? '')
}

function ReferenceFilterControl({
  filterDef,
  filterState,
  columns,
}: {
  filterDef: ReferenceFilterDef
  filterState: UseFilterUrlStateResult
  columns?: SanityColumnDef[]
}) {
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
      <Popover
        content={
          <Card padding={2} radius={3} style={{minWidth: 240}}>
            <Stack space={2}>
              {filterDef.options?.searchable !== false && (
                <TextInput
                  icon={SearchIcon}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.currentTarget.value)}
                />
              )}
              <Stack space={1}>
                {isPending ? (
                  <Text size={1} muted>
                    Loading...
                  </Text>
                ) : !data || data.length === 0 ? (
                  <Text size={1} muted>
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
                        text={getReferenceLabel(filterDef, option, columns)}
                        tone={selected ? 'primary' : 'default'}
                        onClick={() => applySelection(optionId)}
                      />
                    )
                  })
                )}
              </Stack>
            </Stack>
          </Card>
        }
        open={open}
        placement="bottom-start"
        portal
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
      </Popover>
    </Stack>
  )
}

function CustomFilterControl({
  filterDef,
  filterState,
}: {
  filterDef: Extract<FilterDef, {kind: 'custom'}>
  filterState: UseFilterUrlStateResult
}) {
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
      <Popover
        content={
          <Card padding={2} radius={3}>
            <Component
              value={value}
              onChange={(nextValue) => filterState.setFilterValue(filterDef, nextValue)}
              onApply={() => setOpen(false)}
              onClear={() => filterState.clearFilter(filterDef)}
            />
          </Card>
        }
        open={open}
        placement="bottom-start"
        portal
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
      </Popover>
    </Stack>
  )
}
