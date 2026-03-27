import {DocumentTable} from '@sanetti/sanity-table-kit'
import type {ColumnDef, SortConfig, DocumentBase, SelectionConfig} from '@sanetti/sanity-table-kit'
import {column as baseColumn} from '@sanetti/sanity-table-kit'
import {PublishIcon} from '@sanity/icons'
import {publishDocument} from '@sanity/sdk'
import {useApplyDocumentActions, useQuery} from '@sanity/sdk-react'
import {PortalProvider} from '@sanity/ui'
import {Button} from '@sanity/ui'
import {ToastProvider} from '@sanity/ui'
import React from 'react'
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'

import {AddToReleaseButton} from './AddToReleaseButton'
import {CreateReleaseDialog} from './CreateReleaseDialog'
import {PaginationControls} from './PaginationControls'
import {PublishConfirmDialog} from './PublishConfirmDialog'
import {ReleaseProvider, useOptionalReleaseContext} from './ReleaseContext'
import {ReleaseHeader} from './ReleaseHeader'
import {ReleasePicker} from './ReleasePicker'
import {resolveColumnAliases} from './resolveColumnAliases'
import {useCreateDocument, type CreateDocumentConfig} from './useCreateDocument'
import {useResolvedColumns} from './useResolvedColumns'
import {useRoleFilteredColumns} from './useRoleFilteredColumns'
import {useSanityTableData} from './useSanityTableData'

/**
 * Props for the SDK-native SanityDocumentTable component.
 */
export interface SanityDocumentTableProps<T extends DocumentBase = DocumentBase> {
  // === Data Source (required) ===
  /**
   * Document type(s) to fetch.
   * - String: uses server-side pagination via `usePaginatedDocuments`
   * - String[]: uses `useQuery` with `_type in $docTypes`
   */
  documentType: string | string[]

  /**
   * Optional GROQ filter expression appended to the base type filter.
   * When provided with a single documentType, falls back to useQuery mode.
   * @example 'status != "archived" && defined(title)'
   */
  filter?: string

  /**
   * Custom GROQ query parameters merged into the generated query.
   * Use for filter expressions that reference variables (e.g., `$userId`).
   * Internal params ($docType/$docTypes) take precedence over user params.
   * @example { userId: currentUser.id }
   */
  params?: Record<string, unknown>

  // === Columns (required) ===
  /** Column definitions. Fields are treated as GROQ projection expressions. */
  columns: ColumnDef<T>[]

  // === Pagination ===
  /** Number of rows per page. Default: 25. */
  pageSize?: number

  // === Sorting ===
  /** Default sort configuration. */
  defaultSort?: SortConfig

  // === Projection ===
  /** Override auto-generated GROQ projection. */
  projection?: string

  // === Appearance ===
  /** Message displayed when no documents found. */
  emptyMessage?: string
  /** Whether alternating row backgrounds should be shown. Defaults to `false`. */
  stripedRows?: boolean

  // === Callbacks ===
  /** Called when a row is clicked. */
  onRowClick?: (document: T) => void

  // === Pass-through to DocumentTable ===
  /** Render function for bulk-action buttons. */
  bulkActions?: (selection: SelectionConfig<T>) => ReactNode
  /** Called whenever the set of selected rows changes. */
  onSelectionChange?: (selectedRows: T[]) => void

  // === Inline Document Creation ===
  /**
   * Enable inline document creation.
   * - `true`: enables with defaults (button text auto-generated from documentType)
   * - Object: enables with custom config (initialValues, buttonText)
   */
  createDocument?: boolean | CreateDocumentConfig

  // === Releases ===
  /** Enable release-aware UI (header bar, perspective picker, version-aware editing). */
  releases?: boolean

  // === Column Reordering ===
  /** Enable drag-and-drop column reordering. */
  reorderable?: boolean
  /** Controlled column order — array of column IDs. */
  columnOrder?: string[]
  /** Called when column order changes via drag-and-drop. */
  onColumnOrderChange?: (newOrder: string[]) => void
}

/**
 * SDK-native table component.
 * Wraps DocumentTable with automatic data fetching, pagination, and sorting
 * via Sanity SDK hooks.
 *
 * When `releases` is enabled, wraps in ReleaseProvider FIRST so all child
 * hooks (useResolvedColumns, DocumentStatusCell, useSanityTableData) can
 * access the release context for version-aware behavior.
 */
export function SanityDocumentTable<T extends DocumentBase = DocumentBase>(
  props: SanityDocumentTableProps<T>,
) {
  if (props.releases) {
    return (
      <ReleaseProvider>
        <SanityDocumentTableInner {...props} />
      </ReleaseProvider>
    )
  }
  return <SanityDocumentTableInner {...props} />
}

/**
 * Inner table component — all hooks run here, INSIDE ReleaseProvider when releases=true.
 * This ensures useReleaseContext() is available to useResolvedColumns, DocumentStatusCell, etc.
 */
function SanityDocumentTableInner<T extends DocumentBase = DocumentBase>(
  props: SanityDocumentTableProps<T>,
) {
  const {
    documentType,
    filter,
    params,
    columns,
    pageSize,
    defaultSort,
    projection,
    emptyMessage = 'No documents found',
    stripedRows = false,
    onRowClick,
    bulkActions,
    onSelectionChange,
    releases,
    reorderable,
    columnOrder,
    onColumnOrderChange,
    createDocument: createDocumentConfig,
  } = props

  // Always call the optional hook to preserve hook ordering.
  const releaseCtx = useOptionalReleaseContext()
  const perspective = releases ? releaseCtx?.getQueryPerspective() : undefined
  const selectedReleaseId = releases ? (releaseCtx?.selectedReleaseId ?? null) : null

  // When a release is selected, fetch version document IDs to filter client-side
  const releaseVersionQuery = useQuery({
    query: selectedReleaseId
      ? `*[_id in path("versions.${selectedReleaseId}.*")]._id`
      : '*[_id == "___never___"][0..0]',
    params: {},
  })

  // Extract base document IDs from version IDs (versions.<release>.<docId> → <docId>)
  const releaseDocIds = useMemo(() => {
    if (!selectedReleaseId || !Array.isArray(releaseVersionQuery.data)) return null
    const prefix = `versions.${selectedReleaseId}.`
    return new Set(
      (releaseVersionQuery.data as string[])
        .filter((id) => typeof id === 'string' && id.startsWith(prefix))
        .map((id) => id.slice(prefix.length)),
    )
  }, [selectedReleaseId, releaseVersionQuery.data])

  // Inline document creation
  const createConfig = typeof createDocumentConfig === 'object' ? createDocumentConfig : undefined
  const docTypeStr = Array.isArray(documentType) ? documentType[0] : documentType
  const createHook = useCreateDocument({
    documentType: docTypeStr,
    initialValues: createConfig?.initialValues,
  })
  const isCreateEnabled = !!createDocumentConfig
  const createButtonText = createConfig?.buttonText || `Add ${docTypeStr}`

  const combinedFilter = filter || undefined

  // Generate data using ORIGINAL columns (with raw field expressions like 'web.dueDate')
  // so useColumnProjection generates correct GROQ: "dueDate": web.dueDate
  const {
    data: rawData,
    loading: rawLoading,
    pagination,
    sorting,
  } = useSanityTableData<T>({
    documentType,
    filter: combinedFilter,
    columns: columns as ColumnDef[],
    pageSize,
    defaultSort,
    projection,
    perspective,
    params,
  })

  // Client-side filter: when a release is selected, only show documents in that release
  const data = useMemo(() => {
    if (!releaseDocIds || !rawData) return rawData
    return rawData.filter((row) => {
      const baseId = row._id.replace(/^drafts\./, '')
      return releaseDocIds.has(baseId)
    })
  }, [rawData, releaseDocIds])
  const loading = rawLoading || (selectedReleaseId !== null && releaseVersionQuery.isPending)

  // Watch for new data arriving after creation — reset spinner when new row appears
  const {isCreating: isCreateInFlight, resetCreating} = createHook
  const prevDataLengthRef = useRef(data?.length ?? 0)
  useEffect(() => {
    const currentLength = data?.length ?? 0
    if (isCreateInFlight && currentLength > prevDataLengthRef.current) {
      resetCreating()
    }
    prevDataLengthRef.current = currentLength
  }, [data?.length, isCreateInFlight, resetCreating])

  // AFTER projection generation, rewrite fields to aliases for cell access
  // 'web.dueDate' → 'dueDate' (matches the projected alias in the data)
  // Memoized to avoid creating a new array reference on every render, which would cascade
  // through useRoleFilteredColumns → useResolvedColumns → TanStack Table → full row rebuild.
  const aliasedColumns = useMemo(() => resolveColumnAliases(columns as ColumnDef[]), [columns])

  // Filter columns based on current user's roles (visibleTo/editableBy)
  const roleFilteredColumns = useRoleFilteredColumns(aliasedColumns)

  // === Bulk Publish State ===
  const [publishDialogDocs, setPublishDialogDocs] = useState<Array<{
    _id: string
    _type: string
    title?: string
  }> | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const selectionClearRef = React.useRef<(() => void) | null>(null)
  const apply = useApplyDocumentActions()

  const handlePublishClick = useCallback((selectedRows: T[]) => {
    setPublishDialogDocs(
      selectedRows.map((row: T) => ({
        _id: row._id,
        _type: row._type,
        title: row.title as string | undefined,
      })),
    )
  }, [])

  const handlePublishConfirm = useCallback(async () => {
    if (!publishDialogDocs) return
    setIsPublishing(true)
    try {
      const actions = publishDialogDocs.map((doc) =>
        publishDocument({documentId: doc._id.replace('drafts.', ''), documentType: doc._type}),
      )
      await apply(actions)
      setPublishDialogDocs(null)
      selectionClearRef.current?.()
    } catch (err) {
      console.error('[SanityDocumentTable] Bulk publish failed:', err)
    } finally {
      setIsPublishing(false)
    }
  }, [publishDialogDocs, apply])

  const handlePublishClose = useCallback(() => {
    if (!isPublishing) setPublishDialogDocs(null)
  }, [isPublishing])

  // Wrap consumer bulkActions to prepend default Publish button + Add to Release
  const wrappedBulkActions = useCallback(
    (selection: SelectionConfig<T>) => {
      const selectedRows = selection.selectedRows ?? []
      const count = selectedRows.length
      selectionClearRef.current = selection.clearSelection ?? null
      return (
        <>
          {!selectedReleaseId && (
            <Button
              text={`Publish ${count}`}
              icon={PublishIcon}
              tone="positive"
              mode="ghost"
              onClick={() => handlePublishClick(selectedRows as T[])}
              fontSize={1}
              padding={2}
            />
          )}
          {releases && (
            <AddToReleaseButton
              selectedIds={selectedRows.map((r) => r._id)}
              onComplete={() => selectionClearRef.current?.()}
            />
          )}
          {bulkActions?.(selection)}
        </>
      )
    },
    [bulkActions, handlePublishClick, releases, selectedReleaseId],
  )

  // Resolve edit: true markers into actual onSave callbacks via SDK
  const resolvedColumns = useResolvedColumns(roleFilteredColumns as ColumnDef<T>[])

  // Auto-insert select checkbox column for bulk actions
  const finalColumns = useMemo(() => {
    const hasSelect = resolvedColumns.some((c: ColumnDef<T>) => c._isSelectColumn)
    if (hasSelect) return resolvedColumns
    return [baseColumn.select(), ...resolvedColumns]
  }, [resolvedColumns])

  return (
    <PortalProvider>
      <div>
        {releases && <ReleaseHeaderWithPicker />}
        <DocumentTable<T>
          data={data}
          columns={finalColumns}
          loading={loading}
          emptyMessage={emptyMessage}
          stripedRows={stripedRows}
          defaultSort={sorting?.current ?? defaultSort}
          onRowClick={onRowClick}
          bulkActions={wrappedBulkActions}
          onSelectionChange={onSelectionChange}
          reorderable={reorderable}
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
          onCreateDocument={isCreateEnabled ? createHook.create : undefined}
          createButtonText={isCreateEnabled ? createButtonText : undefined}
          isCreating={createHook.isCreating}
        />
        {pagination && <PaginationControls pagination={pagination} loading={loading} />}
        {publishDialogDocs && (
          <PublishConfirmDialog
            documents={publishDialogDocs}
            onConfirm={handlePublishConfirm}
            onClose={handlePublishClose}
            isPublishing={isPublishing}
          />
        )}
      </div>
    </PortalProvider>
  )
}

/**
 * Internal component that renders the release header with picker + create dialog.
 * Must be inside ReleaseProvider.
 */
function ReleaseHeaderWithPicker() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  return (
    <>
      <ReleaseHeader>
        <ReleasePicker onCreateRelease={() => setShowCreateDialog(true)} />
      </ReleaseHeader>
      {showCreateDialog && (
        <ToastProvider>
          <CreateReleaseDialog onClose={() => setShowCreateDialog(false)} />
        </ToastProvider>
      )}
    </>
  )
}
