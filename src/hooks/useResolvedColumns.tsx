import type {ColumnDef, DocumentBase} from '@sanity-labs/react-table-kit'
import {ToggleSwitch} from '@sanity-labs/react-table-kit'
import type {PreviewConfig, PreviewValue} from '@sanity/types'
import React, {useMemo, useCallback} from 'react'

import {ReferenceCell} from '../components/references/ReferenceCell'
import {useSDKEditHandler} from './useSDKEditHandler'

/**
 * Extended edit config with optional reference type marker.
 * @internal
 */
interface EditConfigWithRef {
  _autoSave?: boolean
  _field?: string
  _referenceType?: string
  _preview?: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  _placeholder?: string
  [key: string]: unknown
}

/**
 * Resolves columns with `_autoSave: true` markers into fully-wired
 * edit configs using the SDK's applyDocumentActions.
 *
 * Columns with explicit `onSave` are left untouched.
 * Columns without `edit` are left untouched.
 *
 * Reference columns (with `_referenceType`) get their cell wrapped
 * with edit metadata so ReferenceCell can open the edit popover.
 *
 * @internal Used by SanityDocumentTable and useSanityDocumentTable.
 */
export function useResolvedColumns<T extends DocumentBase = DocumentBase>(
  columns: ColumnDef<T>[],
): ColumnDef<T>[] {
  const {createOnSave, handleEdit} = useSDKEditHandler()

  const applyFieldPatch = useCallback(
    (document: DocumentBase, field: string, value: unknown) => handleEdit(document, field, value),
    [handleEdit],
  )

  const createReferenceOnSave = useCallback(
    (field: string) => {
      return (row: DocumentBase, newValue: {_type: 'reference'; _ref: string} | null) => {
        void applyFieldPatch(row, field, newValue).catch((err) => {
          console.error('[useResolvedColumns] reference apply() threw:', err)
        })
      }
    },
    [applyFieldPatch],
  )

  return useMemo(() => {
    return columns.map((col) => {
      if (!col.edit || !col.edit._autoSave || !col.edit._field) {
        return col
      }

      const editConfig = col.edit as unknown as EditConfigWithRef

      // Reference edit — wrap the existing cell with edit metadata
      if (editConfig._referenceType) {
        const field = editConfig._field!
        const referenceType = editConfig._referenceType
        const preview = editConfig._preview as Required<Pick<PreviewConfig, 'select' | 'prepare'>>
        const placeholder = editConfig._placeholder
        const onSave = createReferenceOnSave(field)

        return {
          ...col,
          edit: undefined, // Remove edit config — ReferenceCell handles its own edit UI
          cell: (value: unknown, row: T) => {
            return (
              <ReferenceCell
                value={value}
                row={row}
                prepare={preview?.prepare as (data: Record<string, unknown>) => PreviewValue}
                selectKeys={preview ? Object.keys(preview.select) : []}
                editMeta={{
                  onSave,
                  referenceType,
                  preview,
                  placeholder,
                  rawRefValue: (() => {
                    // The resolved value is the dereferenced object (not the raw ref).
                    // Use the column's id (alias) to look up the resolved object,
                    // then construct a raw ref from its _id.
                    const colId = col.id || field
                    const resolved = (row as Record<string, unknown>)[colId]
                    if (
                      resolved &&
                      typeof resolved === 'object' &&
                      '_id' in (resolved as Record<string, unknown>)
                    ) {
                      return {
                        _type: 'reference' as const,
                        _ref: String((resolved as Record<string, unknown>)._id),
                      }
                    }
                    return null
                  })(),
                }}
              />
            )
          },
        } as ColumnDef<T>
      }

      // Boolean toggle — replace cell with OptimisticBooleanCell for instant UI feedback
      if (col.edit.mode === 'custom' && col.edit._autoSave && col.edit._field) {
        const field = col.edit._field
        return {
          ...col,
          edit: undefined, // Remove edit config — cell handles its own toggle
          cell: (value: unknown, row: T) => {
            return (
              <OptimisticBooleanCell
                documentId={row._id}
                field={field}
                serverValue={!!value}
                onToggle={(newValue: boolean) => {
                  void applyFieldPatch(row, field, newValue)
                }}
              />
            )
          },
        } as ColumnDef<T>
      }

      // Resolve _autoSave marker into actual onSave callback
      const {_autoSave, _field, ...editRest} = col.edit
      return {
        ...col,
        edit: {
          ...editRest,
          onSave: createOnSave(_field),
        },
      }
    })
  }, [applyFieldPatch, columns, createOnSave, createReferenceOnSave])
}

/**
 * Module-level store for boolean optimistic state.
 * Persists across cell remounts caused by useResolvedColumns useMemo recalculations.
 * Keyed by documentId + field to avoid cross-document interference.
 */
interface BooleanOptimisticEntry {
  optimistic: boolean | null
  editGen: number
  patchedGen: number
  timer: ReturnType<typeof setTimeout> | null
}
const booleanOptimisticStore = new Map<string, BooleanOptimisticEntry>()

const DEBOUNCE_MS = 350

/**
 * Boolean toggle cell with optimistic updates.
 * Uses a module-level store instead of component state so optimistic values
 * survive cell remounts (caused by useResolvedColumns useMemo recalculating).
 */
function OptimisticBooleanCell({
  documentId,
  field,
  serverValue,
  onToggle,
}: {
  documentId: string
  field: string
  serverValue: boolean
  onToggle: (newValue: boolean) => void
}) {
  const storeKey = `${documentId}:${field}`
  const [, forceRender] = React.useState(0)

  // Get or create entry in the persistent store
  if (!booleanOptimisticStore.has(storeKey)) {
    booleanOptimisticStore.set(storeKey, {
      optimistic: null,
      editGen: 0,
      patchedGen: 0,
      timer: null,
    })
  }
  const entry = booleanOptimisticStore.get(storeKey)!

  // Sync: clear optimistic when server catches up AND no newer edits pending
  React.useEffect(() => {
    if (
      entry.optimistic !== null &&
      serverValue === entry.optimistic &&
      entry.editGen === entry.patchedGen
    ) {
      entry.optimistic = null
      forceRender((n) => n + 1)
    }
  }, [serverValue, entry])

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      // Don't clear the store entry — it needs to persist across remounts
      // Only clear the timer if this specific instance created it
    }
  }, [])

  const displayValue = entry.optimistic ?? serverValue

  return (
    <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
      <ToggleSwitch
        checked={displayValue}
        onChange={() => {
          const newValue = !displayValue
          entry.editGen += 1
          entry.optimistic = newValue
          const gen = entry.editGen

          // Mark generation as patched after debounce
          if (entry.timer) clearTimeout(entry.timer)
          entry.timer = setTimeout(() => {
            if (entry.editGen === gen) {
              entry.patchedGen = gen
            }
            entry.timer = null
          }, DEBOUNCE_MS)

          forceRender((n) => n + 1)
          onToggle(newValue)
        }}
      />
    </div>
  )
}
