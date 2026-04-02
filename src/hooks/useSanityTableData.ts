import type {ColumnDef, SortConfig} from '@sanetti/sanity-table-kit'
// In tests, this is mocked via vi.mock('@sanity/sdk-react').
import {usePaginatedDocuments, useQuery} from '@sanity/sdk-react'
import {useState, useCallback, useEffect, useMemo} from 'react'

import {useColumnProjection} from './useColumnProjection'

function resolveServerSortField(columns: ColumnDef[], sort: SortConfig | null): SortConfig | null {
  if (!sort) return null

  const column = columns.find(
    (candidate) => candidate.id === sort.field || candidate.field === sort.field,
  )
  const serverSortField = (column as (ColumnDef & {_serverSortField?: string}) | undefined)
    ?._serverSortField

  if (!serverSortField) return sort

  return {
    ...sort,
    field: serverSortField,
  }
}

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
  /** Optional callback when the effective page size changes. */
  onPageSizeChange?: (pageSize: number) => void
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
  pageSize: number
  setPageSize: (pageSize: number) => void
  goToPage: (pageNumber: number) => void
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
    onPageSizeChange,
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
  const serverSort = useMemo(
    () => resolveServerSortField(columns, currentSort),
    [columns, currentSort],
  )
  const {query, params} = buildQuery(documentType, filter, projection, serverSort, userParams)

  const [effectivePageSize, setEffectivePageSize] = useState(pageSize ?? 25)
  const useSdkPagination = !Array.isArray(documentType) && !filter
  const paginatedOrderings = serverSort
    ? [{field: serverSort.field, direction: serverSort.direction}]
    : undefined
  const paginatedDocumentType = typeof documentType === 'string' ? documentType : '__sanetti_noop__'

  useEffect(() => {
    if (pageSize !== undefined) {
      setEffectivePageSize(pageSize)
    }
  }, [pageSize])

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      setEffectivePageSize(nextPageSize)
      onPageSizeChange?.(nextPageSize)
    },
    [onPageSizeChange],
  )

  const paginatedDocuments = usePaginatedDocuments({
    documentType: paginatedDocumentType,
    orderings: useSdkPagination ? paginatedOrderings : undefined,
    pageSize: useSdkPagination ? effectivePageSize : 1,
    params: useSdkPagination ? userParams : undefined,
    ...(perspective && useSdkPagination ? {perspective} : {}),
  })

  const pageDocumentIds = useMemo(() => {
    if (!useSdkPagination || !Array.isArray(paginatedDocuments.data)) return []

    return paginatedDocuments.data
      .map((item) => {
        if (item && typeof item === 'object') {
          if ('documentId' in item && item.documentId) return String(item.documentId)
          if ('_id' in item && item._id) return String(item._id)
        }

        return null
      })
      .filter((id): id is string => Boolean(id))
  }, [useSdkPagination, paginatedDocuments.data])

  const pageDataIsProjectedRows = useMemo(() => {
    if (
      !useSdkPagination ||
      !Array.isArray(paginatedDocuments.data) ||
      paginatedDocuments.data.length === 0
    ) {
      return false
    }

    return paginatedDocuments.data.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        '_id' in item &&
        !('documentId' in item && item.documentId),
    )
  }, [useSdkPagination, paginatedDocuments.data])

  const pagedProjectionResult = useQuery<T[]>({
    query: `*[_id in $documentIds]${projection}`,
    params: {documentIds: pageDocumentIds},
    ...(perspective && useSdkPagination ? {perspective} : {}),
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
    if (!useSdkPagination) {
      return false
    }

    if (pageDataIsProjectedRows) {
      return true
    }

    if (pageDocumentIds.length === 0) {
      return !paginatedDocuments.isPending
    }

    return pageDocumentIds.every((id) => projectionRowsById.has(id))
  }, [
    useSdkPagination,
    pageDataIsProjectedRows,
    pageDocumentIds,
    paginatedDocuments.isPending,
    projectionRowsById,
  ])

  const transitionLoading = useSdkPagination && (paginatedDocuments.isPending || !pageRowsReady)

  const pagedData = useMemo(() => {
    if (!useSdkPagination) {
      return undefined
    }

    if (paginatedDocuments.isPending || pagedProjectionResult.isPending) {
      return undefined
    }

    if (pageDataIsProjectedRows) {
      return paginatedDocuments.data as T[]
    }

    if (pageDocumentIds.length === 0) {
      return []
    }

    if (!pageRowsReady) {
      return undefined
    }

    return paginatedDocuments.data
      .map((item) => {
        if (item && typeof item === 'object') {
          if ('documentId' in item && item.documentId) {
            return projectionRowsById.get(String(item.documentId))
          }

          if ('_id' in item) {
            return item as T
          }
        }

        return undefined
      })
      .filter((row): row is T => row !== undefined)
  }, [
    useSdkPagination,
    pageDocumentIds.length,
    pageDataIsProjectedRows,
    pageRowsReady,
    paginatedDocuments.data,
    paginatedDocuments.isPending,
    pagedProjectionResult.isPending,
    projectionRowsById,
  ])

  const result = useQuery<T[]>({
    query: useSdkPagination ? '*[_id in []]' : query,
    params: useSdkPagination ? {} : params,
    ...(perspective && !useSdkPagination ? {perspective} : {}),
  })

  if (useSdkPagination) {
    return {
      data: pagedData as T[] | undefined,
      loading: paginatedDocuments.isPending || pagedProjectionResult.isPending,
      transitionLoading,
      pagination: {
        currentPage: paginatedDocuments.currentPage ?? 1,
        totalPages: paginatedDocuments.totalPages ?? 1,
        hasNextPage: paginatedDocuments.hasNextPage ?? false,
        hasPreviousPage: paginatedDocuments.hasPreviousPage ?? false,
        totalCount: paginatedDocuments.totalCount ?? paginatedDocuments.count ?? 0,
        pageSize: effectivePageSize,
        setPageSize,
        goToPage: paginatedDocuments.goToPage ?? (() => {}),
        nextPage: paginatedDocuments.nextPage ?? paginatedDocuments.fetchNextPage ?? (() => {}),
        previousPage:
          paginatedDocuments.previousPage ?? paginatedDocuments.fetchPreviousPage ?? (() => {}),
      },
      sorting: {
        current: currentSort,
        onSortChange,
      },
    }
  }

  return {
    data: Array.isArray(result.data) ? result.data : result.isPending ? undefined : [],
    loading: result.isPending,
    transitionLoading: false,
    pagination: null,
    sorting: null,
  }
}
