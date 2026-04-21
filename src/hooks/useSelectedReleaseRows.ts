import type {ColumnDef, DocumentBase} from '@sanity-labs/react-table-kit'
import {useQuery} from '@sanity/sdk-react'
import {useMemo} from 'react'

import {buildVersionDocumentId, normalizeBaseDocumentId} from '../helpers/releases/documentIds'
import {useColumnProjection} from './useColumnProjection'

interface UseSelectedReleaseRowsOptions<T extends DocumentBase = DocumentBase> {
  columns: ColumnDef[]
  projectionOverride?: string
  rows: T[] | undefined
  selectedReleaseId: string | null
}

interface UseSelectedReleaseRowsResult<T extends DocumentBase = DocumentBase> {
  rowsByBaseId: Map<string, T>
}

export function useSelectedReleaseRows<T extends DocumentBase = DocumentBase>({
  columns,
  projectionOverride,
  rows,
  selectedReleaseId,
}: UseSelectedReleaseRowsOptions<T>): UseSelectedReleaseRowsResult<T> {
  const autoProjection = useColumnProjection(columns)
  const projection = projectionOverride ?? autoProjection

  const versionDocumentIds = useMemo(() => {
    if (!selectedReleaseId || !rows?.length) {
      return []
    }

    return [
      ...new Set(rows.map((row) => buildVersionDocumentId(row._id, selectedReleaseId))),
    ].sort()
  }, [rows, selectedReleaseId])

  const {data} = useQuery<T[]>({
    params: {documentIds: versionDocumentIds},
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
