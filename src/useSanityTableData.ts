import type {ColumnDef, SortConfig} from '@sanetti/sanity-table-kit'
// In tests, this is mocked via vi.mock('@sanity/sdk-react').
import {useQuery} from '@sanity/sdk-react'
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

  // Determine whether to expose pagination controls:
  // - Single string documentType + no filter → expose pagination state
  // - Array documentType OR filter → return full query results
  const usePaginatedMode = typeof documentType === 'string' && !filter

  // Always query projected row data directly. The paginated SDK hook now returns
  // document handles only, which does not satisfy the table's projected row model.
  const {query, params} = buildQuery(documentType, filter, projection, currentSort, userParams)

  // DEBUG: Log the generated query and params
  console.log('[useSanityTableData] query:', query)
  console.log('[useSanityTableData] params:', JSON.stringify(params))
  console.log('[useSanityTableData] perspective:', perspective)

  const result = useQuery<T[]>({
    query,
    params,
    ...(perspective && {perspective}),
  })

  // DEBUG: Log the result
  console.log('[useSanityTableData] isPending:', result.isPending)
  console.log('[useSanityTableData] data:', result.data?.length ?? 'undefined', 'rows')
  console.log('[useSanityTableData] error:', (result as any).error ?? 'none')

  const resolvedPageSize = pageSize ?? 25
  const [currentPage, setCurrentPage] = useState(1)

  const totalCount = result.data?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / resolvedPageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const pagedData = useMemo(() => {
    if (!usePaginatedMode || !Array.isArray(result.data)) return result.data
    const start = (safeCurrentPage - 1) * resolvedPageSize
    const end = start + resolvedPageSize
    return result.data.slice(start, end)
  }, [resolvedPageSize, result.data, safeCurrentPage, usePaginatedMode])

  const nextPage = useCallback(() => {
    setCurrentPage((page) => Math.min(page + 1, totalPages))
  }, [totalPages])

  const previousPage = useCallback(() => {
    setCurrentPage((page) => Math.max(page - 1, 1))
  }, [])

  return {
    data: (usePaginatedMode ? pagedData : result.data) as T[] | undefined,
    loading: result.isPending,
    pagination: usePaginatedMode
      ? {
          currentPage: safeCurrentPage,
          totalPages,
          hasNextPage: safeCurrentPage < totalPages,
          hasPreviousPage: safeCurrentPage > 1,
          totalCount,
          nextPage,
          previousPage,
        }
      : null,
    sorting: usePaginatedMode
      ? {
          current: currentSort,
          onSortChange,
        }
      : null,
  }
}
