import type {ReferenceFilterDef} from '@sanity-labs/react-table-kit'

import type {SanityColumnDef} from '../../hooks/useColumnProjection'

export function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

export function buildReferenceProjection(filterDef: ReferenceFilterDef): string {
  if (!filterDef.preview) return '{_id, title}'
  const parts = Object.entries(filterDef.preview.select).map(([key, path]) =>
    key === path && !path.includes('.') && !path.includes('[') ? key : `"${key}": ${path}`,
  )
  if (!filterDef.preview.select._id) parts.push('_id')
  return `{${parts.join(', ')}}`
}

export function getReferencePreview(filterDef: ReferenceFilterDef, columns?: SanityColumnDef[]) {
  if (filterDef.preview) return filterDef.preview
  return columns?.find((column) => column.field === filterDef.field)?._referencePreview
}

export function getReferenceLabel(
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
