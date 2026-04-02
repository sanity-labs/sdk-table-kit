import {
  CalendarPopoverContent,
  formatDateOnlyString,
  getFilterKey,
  parseDateOnlyString,
  type FilterDef,
} from '@sanetti/sanity-table-kit'
import {CalendarIcon} from '@sanity/icons'
import {Button, Label, Popover, Stack, useClickOutsideEvent, useGlobalKeyDown} from '@sanity/ui'
import type {KeyboardEvent as ReactKeyboardEvent} from 'react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {DayPicker, type DateRange} from 'react-day-picker'

import {formatShortDate, isSameCalendarDay} from '../../../helpers/filters/serverFilterBarUtils'
import type {BaseFilterControlProps} from './types'

export function DateFilterControl({
  filterDef,
  filterState,
}: BaseFilterControlProps<Extract<FilterDef, {kind: 'date'}>>) {
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
                defaultMonth={draftRange?.from ?? committedRange?.from}
                mode="range"
                numberOfMonths={1}
                onSelect={handleSelect}
                selected={draftRange}
                showOutsideDays
              />
            ) : (
              <DayPicker
                defaultMonth={draftRange?.from ?? committedRange?.from}
                mode="single"
                numberOfMonths={1}
                onSelect={(date) => handleSelect(date ? {from: date, to: date} : undefined)}
                selected={draftRange?.from}
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
