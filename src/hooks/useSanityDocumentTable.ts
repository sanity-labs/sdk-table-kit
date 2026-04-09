import type {ColumnDef, DocumentBase, DocumentTableProps} from '@sanity-labs/react-table-kit'
import {useMemo} from 'react'

import type {PaginationControlsProps} from '../components/table/PaginationControls'
import {getServerSortableColumnIds} from '../helpers/filters/getServerSortableColumnIds'
import {resolveColumnAliases} from '../helpers/table/resolveColumnAliases'
import {useResolvedColumns} from './useResolvedColumns'
import {useSanityTableData} from './useSanityTableData'
import type {SanityTableDataConfig, PaginationState} from './useSanityTableData'

/**
 * Result from the composed hook.
 * Returns ready-to-spread props for DocumentTable and PaginationControls.
 */
export interface SanityDocumentTableHookResult<T extends DocumentBase = DocumentBase> {
  /** Spread onto <DocumentTable {...tableProps} /> */
  tableProps: DocumentTableProps<T>
  /** Spread onto <PaginationControls {...paginationProps} /> */
  paginationProps: PaginationControlsProps
  /** Raw data result for custom usage */
  data: T[] | undefined
  /** Loading state */
  loading: boolean
  /** Pagination state (null in query mode) */
  pagination: PaginationState | null
}

/**
 * All-in-one composed hook for SDK-native tables.
 * Combines `useSanityTableData` with table state management.
 * Returns ready-to-spread props for both `DocumentTable` and `PaginationControls`.
 *
 * @example
 * ```tsx
 * function MyCustomLayout() {
 *   const { tableProps, paginationProps } = useSanityDocumentTable({
 *     documentType: 'article',
 *     columns: myColumns,
 *     pageSize: 25,
 *   })
 *
 *   return (
 *     <div>
 *       <MyCustomHeader />
 *       <DocumentTable {...tableProps} />
 *       <PaginationControls {...paginationProps} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useSanityDocumentTable<T extends DocumentBase = DocumentBase>(
  config: SanityTableDataConfig & {
    /** Message displayed when no documents found. */
    emptyMessage?: string
    pageSizeOptions?: number[]
  },
): SanityDocumentTableHookResult<T> {
  const {columns, emptyMessage = 'No documents found', pageSizeOptions, ...dataConfig} = config

  // Resolve column aliases before data fetching and rendering
  const aliasedColumns = resolveColumnAliases(columns as ColumnDef[])

  const result = useSanityTableData<T>({...dataConfig, columns: aliasedColumns})

  // Resolve edit: true markers into actual onSave callbacks via SDK
  const resolvedColumns = useResolvedColumns(aliasedColumns as ColumnDef<T>[])
  const serverSortableColumnIds = useMemo(
    () => (result.sorting ? getServerSortableColumnIds(resolvedColumns as ColumnDef[]) : undefined),
    [resolvedColumns, result.sorting],
  )

  const tableProps: DocumentTableProps<T> = {
    data: result.data,
    columns: resolvedColumns,
    loading: result.loading,
    ...(result.transitionLoading &&
      result.pagination && {transitionLoadingRowCount: result.pagination.pageSize}),
    emptyMessage,
    ...(result.sorting?.current && {defaultSort: result.sorting.current}),
    ...(result.sorting && {
      serverSort: {
        sort: result.sorting.current,
        onSortChange: result.sorting.onSortChange,
        sortableColumnIds: serverSortableColumnIds,
      },
    }),
  }

  // Provide a safe default pagination for PaginationControls
  const safePagination: PaginationState = result.pagination ?? {
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    totalCount: 0,
    nextPage: () => {},
    previousPage: () => {},
    pageSize: config.pageSize ?? 25,
    setPageSize: () => {},
    goToPage: () => {},
  }

  const paginationProps: PaginationControlsProps = {
    pagination: safePagination,
    loading: result.loading,
    pageSizeOptions,
  }

  return {
    tableProps,
    paginationProps,
    data: result.data,
    loading: result.loading,
    pagination: result.pagination,
  }
}
