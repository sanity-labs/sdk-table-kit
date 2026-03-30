import type {ColumnDef, DocumentBase} from '@sanetti/sanity-table-kit'
import {ToggleSwitch} from '@sanetti/sanity-table-kit'
import {editDocument} from '@sanity/sdk'
import {useApplyDocumentActions} from '@sanity/sdk-react'
import type {PreviewConfig, PreviewValue} from '@sanity/types'
import React, {useMemo, useCallback, useRef} from 'react'

import {ReferenceCell} from './ReferenceCell'
import {useOptionalReleaseContext} from './ReleaseContext'

/**
 * Resolve a document ID for editing based on the active release.
 * When a release is selected, edits target the version document.
 * Strips drafts./versions. prefixes to get the published base ID first.
 */
function resolveEditDocumentId(documentId: string, selectedReleaseId: string | null): string {
  // Strip any prefix to get the published base ID
  let baseId = documentId
  if (baseId.startsWith('drafts.')) {
    baseId = baseId.slice(7)
  } else if (baseId.startsWith('versions.')) {
    // versions.<releaseName>.<docId> — extract docId
    const parts = baseId.split('.')
    baseId = parts.slice(2).join('.')
  }

  if (selectedReleaseId) {
    return `versions.${selectedReleaseId}.${baseId}`
  }
  return documentId
}

function createDocumentHandle(document: DocumentBase, documentId: string) {
  return {
    documentId,
    documentType: document._type,
  }
}

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
  const apply = useApplyDocumentActions()

  // Get release context for version-aware editing (null if no ReleaseProvider)
  const releaseCtx = useOptionalReleaseContext()
  const selectedReleaseId = releaseCtx?.selectedReleaseId ?? null

  const applyFieldPatch = useCallback(
    (document: DocumentBase, field: string, value: unknown) => {
      const targetId = resolveEditDocumentId(document._id, selectedReleaseId)
      const action = editDocument(createDocumentHandle(document, targetId), {set: {[field]: value}})
      return apply(action)
    },
    [apply, selectedReleaseId],
  )

  const createOnSave = useCallback(
    (field: string) => {
      return (document: DocumentBase, newValue: string) => {
        console.log('[useResolvedColumns] SDK auto-save:', {
          documentId: document._id,
          field,
          newValue,
        })
        try {
          const result = applyFieldPatch(document, field, newValue)
          console.log('[useResolvedColumns] apply() returned:', result)
          if (result && typeof result.then === 'function') {
            result.then(
              (res: unknown) => console.log('[useResolvedColumns] apply() resolved:', res),
              (err: unknown) => console.error('[useResolvedColumns] apply() rejected:', err),
            )
          }
        } catch (err) {
          console.error('[useResolvedColumns] apply() threw:', err)
        }
      }
    },
    [applyFieldPatch],
  )

  const createReferenceOnSave = useCallback(
    (field: string) => {
      return (row: DocumentBase, newValue: {_type: 'reference'; _ref: string} | null) => {
        try {
          applyFieldPatch(row, field, newValue)
        } catch (err) {
          console.error('[useResolvedColumns] reference apply() threw:', err)
        }
      }
    },
    [applyFieldPatch],
  )

  // Diagnostic: track which dep changed on EVERY render
  const prevDepsRef = useRef<{
    columns: unknown
    createOnSave: unknown
    createReferenceOnSave: unknown
    applyFieldPatch: unknown
    apply: unknown
    selectedReleaseId: unknown
  }>({columns: undefined, createOnSave: undefined, createReferenceOnSave: undefined, applyFieldPatch: undefined, apply: undefined, selectedReleaseId: undefined})

  const changed: string[] = []
  if (prevDepsRef.current.columns !== undefined && prevDepsRef.current.columns !== columns) changed.push('columns')
  if (prevDepsRef.current.createOnSave !== undefined && prevDepsRef.current.createOnSave !== createOnSave) changed.push('createOnSave')
  if (prevDepsRef.current.createReferenceOnSave !== undefined && prevDepsRef.current.createReferenceOnSave !== createReferenceOnSave) changed.push('createReferenceOnSave')
  if (prevDepsRef.current.applyFieldPatch !== undefined && prevDepsRef.current.applyFieldPatch !== applyFieldPatch) changed.push('applyFieldPatch')
  if (prevDepsRef.current.apply !== undefined && prevDepsRef.current.apply !== apply) changed.push('apply(useApplyDocumentActions)')
  if (prevDepsRef.current.selectedReleaseId !== undefined && prevDepsRef.current.selectedReleaseId !== selectedReleaseId) changed.push('selectedReleaseId')
  prevDepsRef.current = {columns, createOnSave, createReferenceOnSave, applyFieldPatch, apply, selectedReleaseId}

  console.count('[useResolvedColumns] render')
  if (changed.length > 0) {
    console.warn('[useResolvedColumns] ⚠️ DEPS CHANGED:', changed.join(', '))
  } else {
    console.log('[useResolvedColumns] first render or no deps changed')
  }

  return useMemo(() => {
    console.log(
      '[useResolvedColumns] useMemo recalculating — columns changed or createOnSave/createReferenceOnSave changed',
    )
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
        console.log('[useResolvedColumns] reference column resolved', {
          field,
          referenceType,
          placeholder,
        })

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
