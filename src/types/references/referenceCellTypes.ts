import type {DocumentBase} from '@sanity-labs/react-table-kit'
import type {PreviewValue} from '@sanity/types'

export interface EditMeta {
  onSave: (row: DocumentBase, newValue: {_type: 'reference'; _ref: string} | null) => void
  placeholder?: string
  preview: {
    prepare: (data: Record<string, unknown>) => PreviewValue
    select: Record<string, string>
  }
  rawRefValue: {_type: 'reference'; _ref: string} | null
  referenceType: string
}

export interface ReferenceCellProps {
  editMeta?: EditMeta
  prepare: (data: Record<string, unknown>) => PreviewValue
  row: DocumentBase
  selectKeys: string[]
  value: unknown
}
