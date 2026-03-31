import type {ColumnDef, SortConfig} from '@sanetti/sanity-table-kit'
// In tests, this is mocked via vi.mock('@sanity/sdk-react').
import {usePaginatedDocuments, useQuery} from '@sanity/sdk-react'
import {useState, useCallback, useMemo} from 'react'

import {useColumnProjection} from './useColumnProjection'

/**
 * Configuration for the core SDK data-fetching hook.
 */
export interface SanityTableDataConfig {
  /**
   * Document type(s) to fetch.
   * - String: uses `usePaginatedDocuments` for server-side pagination
   * - String[]: uses `useQuery` with `_type in $docTypes` filter
   */
  documentType: string | string[]
  /**
   * Optional GROQ filter expression appended to the base type filter.
   * When provided with a single documentType, falls back to useQuery mode
   * (no server-side pagination).
   *
   * @example 'status != "archived" && defined(title)'
   */
  filter?: string
  /** Column definitions — used for auto-generating GROQ projections. */
  columns: ColumnDef[]
  /** Number of rows per page. Default: 25 when using usePaginatedDocuments. */
  pageSize?: number
  /** Override auto-generated GROQ projection. */
  projection?: string
  /** Default sort configuration. Applied as server-side orderings in paginated mode. */
  defaultSort?: SortConfig
  /**
   * Query perspective for release-aware data fetching.
   * - 'published' (default) — show published data
   * - [releaseName, 'published'] — show data as if release were published
   */
  perspective?: 'published' | [string, 'published'] | string[]
  /**
   * Custom GROQ query parameters merged into the generated query.
   * Internal params ($docType/$docTypes) take precedence.
   */
  params?: Record<string, unknown>
}

/**
 * Server-side pagination state.
 */
export interface PaginationState {
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalCount: number
  nextPage: () => void
  previousPage: () => void
}

/**
 * Server-side sorting state.
 */
export interface SortingState {
  current: SortConfig | null
  onSortChange: (sort: SortConfig | null) => void
}

/**
 * Result from the SDK data-fetching hook.
 */
export interface SanityTableDataResult<T = Record<string, unknown>> {
  /** Row data from the SDK. */
  data: T[] | undefined
  /** Whether the SDK hook is still loading. */
  loading: boolean
  /** Whether the current paginated page is still hydrating projected row data. */
  transitionLoading: boolean
  /** Server-side pagination state. Null when using useQuery mode. */
  pagination: PaginationState | null
  /** Server-side sorting state. Null when using useQuery mode (client-side sorting). */
  sorting: SortingState | null
}

/**
 * Build a GROQ query from documentType, filter, and projection.
 */
function buildQuery(
  documentType: string | string[],
  filter: string | undefined,
  projection: string,
  sort: SortConfig | null,
  userParams?: Record<string, unknown>,
): {query: string; params: Record<string, unknown>} {
  const isArray = Array.isArray(documentType)
  const typeFilter = isArray ? '_type in $docTypes' : '_type == $docType'
  const fullFilter = filter ? `${typeFilter} && ${filter}` : typeFilter
  const orderClause = sort ? ` | order(${sort.field} ${sort.direction})` : ''

  return {
    query: `*[${fullFilter}]${projection}${orderClause}`,
    params: {
      ...userParams,
      ...(isArray ? {docTypes: documentType} : {docType: documentType}),
    },
  }
}

/**
 * Core adapter hook that wraps SDK's `usePaginatedDocuments` / `useQuery`.
 *
 * Strategy:
 * - Single documentType + no filter → paginated locally from a GROQ query
 * - Array documentType OR filter present → `useQuery` (client-side, assembled GROQ)
 *
 * Projection is auto-generated from column definitions unless overridden.
 */
export function useSanityTableData<T = Record<string, unknown>>(
  config: SanityTableDataConfig,
): SanityTableDataResult<T> {
  const {
    documentType,
    filter,
    columns,
    pageSize,
    projection: projectionOverride,
    defaultSort,
    perspective,
    params: userParams,
  } = config

  // Generate projection from columns (or use override)
  const autoProjection = useColumnProjection(columns)
  const projection = projectionOverride ?? autoProjection

  // Sort state (only used in paginated mode)
  const [currentSort, setCurrentSort] = useState<SortConfig | null>(defaultSort ?? null)

  const onSortChange = useCallback((sort: SortConfig | null) => {
    setCurrentSort(sort)
  }, [])
  const {query, params} = buildQuery(documentType, filter, projection, currentSort, userParams)

  const resolvedPageSize = pageSize ?? 25
  const useSdkPagination = pageSize !== undefined
  const paginatedOrderings = currentSort
    ? [{field: currentSort.field, direction: currentSort.direction}]
    : undefined

  const paginatedDocuments = usePaginatedDocuments({
    documentType: useSdkPagination ? documentType : [],
    filter: useSdkPagination ? filter : '_id == "___never___"',
    orderings: useSdkPagination ? paginatedOrderings : undefined,
    pageSize: useSdkPagination ? resolvedPageSize : 1,
    params: useSdkPagination ? userParams : {},
    ...(perspective && {perspective}),
  })

  const pageDocumentIds = useMemo(
    () => (useSdkPagination ? paginatedDocuments.data.map((handle) => handle.documentId) : []),
    [paginatedDocuments.data, useSdkPagination],
  )

  const pagedProjectionResult = useQuery<T[]>({
    query: `*[_id in $documentIds]${projection}`,
    params: {documentIds: pageDocumentIds},
    ...(perspective && {perspective}),
  })

  const result = useQuery<T[]>({
    query,
    params,
    ...(perspective && {perspective}),
  })

  const projectionRowsById = useMemo(() => {
    const byId = new Map<string, T>()

    if (!Array.isArray(pagedProjectionResult.data)) {
      return byId
    }

    for (const row of pagedProjectionResult.data) {
      const rowId =
        row && typeof row === 'object' && '_id' in (row as Record<string, unknown>)
          ? String((row as Record<string, unknown>)._id)
          : null

      if (rowId) {
        byId.set(rowId, row)
      }
    }

    return byId
  }, [pagedProjectionResult.data])

  const pageRowsReady = useMemo(() => {
    if (!useSdkPagination) return true
    if (pageDocumentIds.length === 0) return !paginatedDocuments.isPending

    return pageDocumentIds.every((id) => projectionRowsById.has(id))
  }, [pageDocumentIds, paginatedDocuments.isPending, projectionRowsById, useSdkPagination])

  const transitionLoading = useSdkPagination && (paginatedDocuments.isPending || !pageRowsReady)

  const pagedData = useMemo(() => {
    if (!useSdkPagination) return result.data
    if (pageDocumentIds.length === 0) {
      return paginatedDocuments.isPending ? undefined : []
    }
    if (!pageRowsReady) return undefined

    return paginatedDocuments.data
      .map((handle) => projectionRowsById.get(handle.documentId))
      .filter((row): row is T => row !== undefined)
  }, [
    pageDocumentIds.length,
    pageRowsReady,
    paginatedDocuments.data,
    paginatedDocuments.isPending,
    projectionRowsById,
    useSdkPagination,
  ])

  return {
    data: (useSdkPagination ? pagedData : result.data) as T[] | undefined,
    loading: useSdkPagination
      ? paginatedDocuments.isPending || pagedProjectionResult.isPending
      : result.isPending,
    transitionLoading,
    pagination: useSdkPagination
      ? {
          currentPage: paginatedDocuments.currentPage,
          totalPages: paginatedDocuments.totalPages,
          hasNextPage: paginatedDocuments.hasNextPage,
          hasPreviousPage: paginatedDocuments.hasPreviousPage,
          totalCount: paginatedDocuments.count,
          nextPage: paginatedDocuments.nextPage,
          previousPage: paginatedDocuments.previousPage,
        }
      : null,
    sorting: useSdkPagination
      ? {
          current: currentSort,
          onSortChange,
        }
      : null,
  }
}
