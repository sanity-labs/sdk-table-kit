import {DocumentTable} from '@sanity-labs/react-table-kit'
import type {
  ColumnDef,
  FilterDef,
  SortConfig,
  UseFilterUrlStateResult,
  DocumentBase,
  SelectionConfig,
  ComputedFilterConfig,
} from '@sanity-labs/react-table-kit'
import {column as baseColumn} from '@sanity-labs/react-table-kit'
import {mapFilterValuesToInitialValues, useFilterUrlState} from '@sanity-labs/react-table-kit'
import {PublishIcon} from '@sanity/icons'
import {publishDocument} from '@sanity/sdk'
import {useApplyDocumentActions} from '@sanity/sdk-react'
import {PortalProvider} from '@sanity/ui'
import {Button} from '@sanity/ui'
import {ToastProvider} from '@sanity/ui'
import React from 'react'
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'

import {DocumentStatusBatchProvider} from '../../context/DocumentStatusBatchContext'
import {ReleaseProvider, useOptionalReleaseContext} from '../../context/ReleaseContext'
import {compileFilters} from '../../helpers/filters/compileFilters'
import {getServerSortableColumnIds} from '../../helpers/filters/getServerSortableColumnIds'
import {normalizeBaseDocumentId} from '../../helpers/releases/documentIds'
import {resolveColumnAliases} from '../../helpers/table/resolveColumnAliases'
import {useCreateDocument, type CreateDocumentConfig} from '../../hooks/useCreateDocument'
import {useDocumentStatusBatch} from '../../hooks/useDocumentStatusBatch'
import {useResolvedColumns} from '../../hooks/useResolvedColumns'
import {useRoleFilteredColumns} from '../../hooks/useRoleFilteredColumns'
import {useSanityTableData} from '../../hooks/useSanityTableData'
import {useSelectedReleaseRows} from '../../hooks/useSelectedReleaseRows'
import {ServerFilterBar} from '../filters/ServerFilterBar'
import {AddToReleaseButton} from '../releases/AddToReleaseButton'
import {CreateReleaseDialog} from '../releases/CreateReleaseDialog'
import {PublishConfirmDialog} from '../releases/PublishConfirmDialog'
import {ReleaseHeader} from '../releases/ReleaseHeader'
import {ReleasePicker} from '../releases/ReleasePicker'
import {PaginationControls} from './PaginationControls'

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
   * When provided without `pageSize`, falls back to useQuery mode.
   * When `pageSize` is set, the filter is applied to the server-paginated result.
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
  /**
   * Explicit server-backed filters rendered above the table.
   * These are compiled into GROQ and merged with the low-level `filter` prop.
   */
  filters?: FilterDef[]
  /**
   * Optional shared filter state source of truth.
   * Useful when another surface such as stats cards or presets should apply the
   * same URL-backed filter state the table itself uses.
   */
  filterState?: UseFilterUrlStateResult

  // === Columns (required) ===
  /** Column definitions. Fields are treated as GROQ projection expressions. */
  columns: ColumnDef<T>[]

  // === Pagination ===
  /** Number of rows per page. Default: 25. */
  pageSize?: number
  /** User-selectable page size options shown in the pagination controls. */
  pageSizeOptions?: number[]
  /** Optional callback when the effective page size changes. */
  onPageSizeChange?: (pageSize: number) => void

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
  /** Enable release-aware UI (header bar, staging-target picker, version-aware editing). */
  releases?: boolean

  // === Computed Filters ===
  /** Named computed filters that can be activated externally (e.g., by stats cards). */
  computedFilters?: Record<string, ComputedFilterConfig>

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
 * Inner table component — all common hooks run here.
 */
function SanityDocumentTableInner<T extends DocumentBase = DocumentBase>(
  props: SanityDocumentTableProps<T>,
) {
  const {
    documentType,
    filter,
    params,
    filters,
    filterState: controlledFilterState,
    columns,
    pageSize,
    pageSizeOptions,
    onPageSizeChange,
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
    computedFilters,
  } = props

  // Always call the optional hook to preserve hook ordering.
  const releaseCtx = useOptionalReleaseContext()
  const selectedReleaseId = releases ? (releaseCtx?.selectedReleaseId ?? null) : null

  const internalFilterState = useFilterUrlState(filters)
  const filterState = controlledFilterState ?? internalFilterState
  const compiledFilters = useMemo(
    () =>
      compileFilters(filters, {
        documentType,
        values: filterState.values,
        params,
      }),
    [documentType, filterState.values, filters, params],
  )

  // Inline document creation
  const createConfig = typeof createDocumentConfig === 'object' ? createDocumentConfig : undefined
  const docTypeStr = Array.isArray(documentType) ? documentType[0] : documentType
  const activeCreateFilters = useMemo(
    () => mapFilterValuesToInitialValues(filters, filterState.values),
    [filterState.values, filters],
  )
  const createHook = useCreateDocument({
    documentType: docTypeStr,
    initialValues: createConfig?.initialValues,
    activeFilters: Object.keys(activeCreateFilters).length > 0 ? activeCreateFilters : undefined,
  })
  const isCreateEnabled = !!createDocumentConfig
  const createButtonText = createConfig?.buttonText || `Add ${docTypeStr}`
  const combinedFilter = useMemo(() => {
    if (filter && compiledFilters.groq) return `(${filter}) && (${compiledFilters.groq})`
    return filter ?? compiledFilters.groq ?? undefined
  }, [compiledFilters.groq, filter])
  const combinedParams = useMemo(
    () => ({
      ...(params ?? {}),
      ...compiledFilters.params,
    }),
    [compiledFilters.params, params],
  )

  // Generate data using ORIGINAL columns (with raw field expressions like 'web.dueDate')
  // so useColumnProjection generates correct GROQ: "dueDate": web.dueDate
  const {
    data: rawData,
    loading: rawLoading,
    transitionLoading,
    pagination,
    sorting,
  } = useSanityTableData<T>({
    documentType,
    filter: combinedFilter,
    columns: columns as ColumnDef[],
    pageSize,
    onPageSizeChange,
    defaultSort,
    projection,
    params: combinedParams,
  })

  const {rowsByBaseId: selectedReleaseRowsByBaseId} = useSelectedReleaseRows<T>({
    columns: columns as ColumnDef[],
    projectionOverride: projection,
    rows: rawData,
    selectedReleaseId,
  })

  const data = useMemo(() => {
    if (!Array.isArray(rawData) || selectedReleaseRowsByBaseId.size === 0) {
      return rawData
    }

    return rawData.map((row) => {
      const selectedReleaseRow = selectedReleaseRowsByBaseId.get(normalizeBaseDocumentId(row._id))

      if (!selectedReleaseRow) {
        return row
      }

      return {
        ...row,
        ...selectedReleaseRow,
      }
    })
  }, [rawData, selectedReleaseRowsByBaseId])
  const loading = rawLoading

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
  const serverSortableColumnIds = useMemo(
    () => (sorting ? getServerSortableColumnIds(finalColumns as ColumnDef[]) : undefined),
    [finalColumns, sorting],
  )
  const hasDocumentStatusColumn = finalColumns.some((column) => column.id === '_status')
  const tableElement = (
    <DocumentTable<T>
      data={data}
      columns={finalColumns}
      loading={loading}
      transitionLoadingRowCount={pagination && transitionLoading ? pagination.pageSize : undefined}
      emptyMessage={emptyMessage}
      stripedRows={stripedRows}
      defaultSort={sorting?.current ?? defaultSort}
      serverSort={
        sorting
          ? {
              sort: sorting.current,
              onSortChange: sorting.onSortChange,
              sortableColumnIds: serverSortableColumnIds,
            }
          : undefined
      }
      onRowClick={onRowClick}
      bulkActions={wrappedBulkActions}
      onSelectionChange={onSelectionChange}
      reorderable={reorderable}
      columnOrder={columnOrder}
      onColumnOrderChange={onColumnOrderChange}
      onCreateDocument={isCreateEnabled ? createHook.create : undefined}
      createButtonText={isCreateEnabled ? createButtonText : undefined}
      isCreating={createHook.isCreating}
      computedFilters={computedFilters}
      hideFilterBar={!!filters?.length}
    />
  )

  return (
    <PortalProvider>
      <div>
        {releases && <ReleaseHeaderWithPicker />}
        {filters && filters.length > 0 && (
          <ServerFilterBar
            filterState={filterState}
            filters={filters}
            columns={columns as ColumnDef[]}
          />
        )}
        {hasDocumentStatusColumn ? (
          <DocumentStatusBatchTable rows={data as DocumentBase[] | undefined}>
            {tableElement}
          </DocumentStatusBatchTable>
        ) : (
          tableElement
        )}
        {pagination && (
          <PaginationControls
            pagination={pagination}
            loading={loading}
            pageSizeOptions={pageSizeOptions}
          />
        )}
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

function DocumentStatusBatchTable({
  rows,
  children,
}: {
  rows: Array<Pick<DocumentBase, '_id'>> | undefined
  children: React.ReactNode
}) {
  const statusBatch = useDocumentStatusBatch(rows)

  return <DocumentStatusBatchProvider value={statusBatch}>{children}</DocumentStatusBatchProvider>
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
