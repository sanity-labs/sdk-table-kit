import type {ColumnDef, DocumentBase} from '@sanity-labs/react-table-kit'
import {useQuery} from '@sanity/sdk-react'
import {useMemo} from 'react'

import {normalizeBaseDocumentId} from '../helpers/releases/documentIds'
import {useColumnProjection} from './useColumnProjection'

interface UsePublishedComparisonRowsOptions<T extends DocumentBase = DocumentBase> {
  columns: ColumnDef[]
  projectionOverride?: string
  rows: T[] | undefined
}

interface UsePublishedComparisonRowsResult<T extends DocumentBase = DocumentBase> {
  rowsByBaseId: Map<string, T>
}

export function usePublishedComparisonRows<T extends DocumentBase = DocumentBase>({
  columns,
  projectionOverride,
  rows,
}: UsePublishedComparisonRowsOptions<T>): UsePublishedComparisonRowsResult<T> {
  const autoProjection = useColumnProjection(columns)
  const projection = projectionOverride ?? autoProjection

  const publishedDocumentIds = useMemo(() => {
    if (!rows?.length) {
      return []
    }

    return [...new Set(rows.map((row) => normalizeBaseDocumentId(row._id)))].sort()
  }, [rows])

  const {data} = useQuery<T[]>({
    params: {documentIds: publishedDocumentIds},
    perspective: 'raw' as unknown as undefined,
    query: `*[_id in $documentIds]${projection}`,
  })

  const rowsByBaseId = useMemo(() => {
    const byBaseId = new Map<string, T>()

    if (!Array.isArray(data)) {
      return byBaseId
    }

    for (const row of data) {
      byBaseId.set(normalizeBaseDocumentId(row._id), row)
    }

    return byBaseId
  }, [data])

  return {rowsByBaseId}
}
