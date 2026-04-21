import type {DocumentBase} from '@sanity-labs/react-table-kit'
import {useActiveReleases, useQuery} from '@sanity/sdk-react'
import {useMemo} from 'react'

import type {
  ActiveReleaseSnapshot,
  DocumentStatusBatchContextValue,
  DocumentStatusSnapshot,
} from '../context/DocumentStatusBatchContext'
import {normalizeBaseDocumentId} from '../helpers/releases/documentIds'
export {normalizeBaseDocumentId} from '../helpers/releases/documentIds'

export function useDocumentStatusBatch(
  rows: Array<Pick<DocumentBase, '_id'>> | undefined,
): DocumentStatusBatchContextValue {
  const activeReleases = useActiveReleases() as ActiveReleaseSnapshot[]

  const baseIds = useMemo(() => {
    if (!rows?.length) return []

    return [...new Set(rows.map((row) => normalizeBaseDocumentId(row._id)).filter(Boolean))].sort()
  }, [rows])

  const candidateIds = useMemo(() => {
    if (baseIds.length === 0) return []

    const ids = new Set<string>()
    const releaseNames = activeReleases.map((release) => release.name)

    for (const baseId of baseIds) {
      ids.add(baseId)
      ids.add(`drafts.${baseId}`)

      for (const releaseName of releaseNames) {
        ids.add(`versions.${releaseName}.${baseId}`)
      }
    }

    return [...ids].sort()
  }, [activeReleases, baseIds])

  const {data, isPending} = useQuery<Array<{_id: string}>>({
    query: '*[_id in $documentIds]{ _id }',
    params: {documentIds: candidateIds},
    perspective: 'raw' as unknown as undefined,
  })

  const statusByBaseId = useMemo(() => {
    const statusMap = new Map<string, DocumentStatusSnapshot>()

    if (!Array.isArray(data)) {
      return statusMap
    }

    for (const item of data) {
      if (!item?._id) continue

      const baseId = normalizeBaseDocumentId(item._id)
      const existing = statusMap.get(baseId)

      if (existing) {
        statusMap.set(baseId, {
          versionIds: [...existing.versionIds, item._id],
        })
      } else {
        statusMap.set(baseId, {versionIds: [item._id]})
      }
    }

    return statusMap
  }, [data])

  return {
    activeReleases,
    loading: isPending,
    statusByBaseId,
  }
}
