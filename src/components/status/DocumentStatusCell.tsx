import {useQuery, useActiveReleases} from '@sanity/sdk-react'
import {Box, Flex, Text, Tooltip, Stack} from '@sanity/ui'
import React, {useMemo} from 'react'

import type {ActiveReleaseSnapshot} from '../../context/DocumentStatusBatchContext'
import {useOptionalDocumentStatusBatchContext} from '../../context/DocumentStatusBatchContext'
import {normalizeBaseDocumentId} from '../../hooks/useDocumentStatusBatch'

/**
 * Compute a numeric sort priority for document status.
 * Lower = less "done", sorts first (drafts bubble to top).
 */
export function getStatusSortPriority(documentId: string): number {
  const isDraft = documentId.startsWith('drafts.')
  return isDraft ? 1 : 3
}

/**
 * Status dot colors matching Sanity Studio conventions.
 */
const STATUS_COLORS = {
  published: 'var(--card-badge-positive-dot-color, #43d675)',
  draft: 'var(--card-badge-caution-dot-color, #f5a623)',
  asap: '#f59e0b',
  scheduled: '#8b5cf6',
  undecided: '#6b7280',
  muted: 'var(--card-muted-fg-color)',
} as const

interface StatusDot {
  color: string
  label: string
}

const DOT_SIZE = 9
const DOT_OVERLAP = -3 // negative margin for overlapping effect

function buildStatusDots(
  baseId: string,
  existingIds: ReadonlySet<string>,
  activeReleases: ReadonlyArray<ActiveReleaseSnapshot>,
) {
  const dots: StatusDot[] = []

  if (existingIds.has(baseId)) {
    dots.push({color: STATUS_COLORS.published, label: 'Published'})
  }

  if (existingIds.has(`drafts.${baseId}`)) {
    dots.push({color: STATUS_COLORS.draft, label: 'Draft'})
  }

  const releaseMap = new Map<string, ActiveReleaseSnapshot>()
  for (const release of activeReleases) {
    releaseMap.set(release.name, release)
  }

  const releaseDots: Array<StatusDot & {type: string}> = []
  for (const id of existingIds) {
    if (!id.startsWith('versions.')) continue

    const withoutPrefix = id.slice('versions.'.length)
    const dotIndex = withoutPrefix.indexOf('.')
    if (dotIndex === -1) continue

    const releaseName = withoutPrefix.slice(0, dotIndex)
    const release = releaseMap.get(releaseName)
    if (!release) continue

    const type = release.metadata.releaseType ?? 'undecided'
    releaseDots.push({
      color: STATUS_COLORS[type] ?? STATUS_COLORS.muted,
      label: release.metadata.title ?? release.name,
      type,
    })
  }

  const typeOrder = ['asap', 'scheduled', 'undecided']
  releaseDots.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))
  dots.push(...releaseDots)

  if (dots.length === 0) {
    dots.push({color: STATUS_COLORS.muted, label: 'New'})
  }

  return dots
}

function StatusDots({dots}: {dots: StatusDot[]}) {
  const tooltipContent = (
    <Box padding={2}>
      <Stack space={2}>
        {dots.length > 1 && (
          <Text size={0} weight="semibold" muted>
            Document versions
          </Text>
        )}
        {dots.map((dot, i) => (
          <Flex key={i} align="center" gap={2}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: dot.color,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <Text size={1}>{dot.label}</Text>
          </Flex>
        ))}
      </Stack>
    </Box>
  )

  return (
    <Tooltip content={tooltipContent} placement="bottom" portal>
      <Box
        data-testid="status-dots-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 0,
          cursor: 'default',
        }}
      >
        {dots.map((dot, i) => (
          <span
            key={i}
            data-testid="status-dot"
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: '50%',
              backgroundColor: dot.color,
              display: 'inline-block',
              border: '1.5px solid var(--card-bg-color, #fff)',
              marginLeft: i > 0 ? DOT_OVERLAP : 0,
              position: 'relative',
              zIndex: dots.length - i,
            }}
          />
        ))}
      </Box>
    </Tooltip>
  )
}

/**
 * Renders document status dots with tooltip.
 *
 * Uses `sanity::versionOf()` GROQ function to find ALL versions of a document
 * (published, draft, and release versions) in a single query.
 * Requires perspective: 'raw' and apiVersion >= 2025-02-19.
 */
export function DocumentStatusCell({
  documentId,
  documentType: _documentType,
}: {
  documentId: string
  documentType: string
}) {
  const statusBatch = useOptionalDocumentStatusBatchContext()

  if (statusBatch) {
    return (
      <BatchedDocumentStatusCell
        documentId={documentId}
        activeReleases={statusBatch.activeReleases}
        versionIds={
          statusBatch.statusByBaseId.get(normalizeBaseDocumentId(documentId))?.versionIds ?? []
        }
      />
    )
  }

  return <LegacyDocumentStatusCell documentId={documentId} />
}

function BatchedDocumentStatusCell({
  documentId,
  activeReleases,
  versionIds,
}: {
  documentId: string
  activeReleases: ReadonlyArray<ActiveReleaseSnapshot>
  versionIds: ReadonlyArray<string>
}) {
  const baseId = normalizeBaseDocumentId(documentId)
  const dots = useMemo(
    () => buildStatusDots(baseId, new Set(versionIds), activeReleases),
    [activeReleases, baseId, versionIds],
  )

  return <StatusDots dots={dots} />
}

function LegacyDocumentStatusCell({documentId}: {documentId: string}) {
  const baseId = normalizeBaseDocumentId(documentId)
  const activeReleases = useActiveReleases()

  const {data: versionDocs} = useQuery({
    query: `*[sanity::versionOf($publishedId)]{ _id, _updatedAt }`,
    params: {publishedId: baseId},
    perspective: 'raw' as unknown as undefined,
  })

  const existingIds = useMemo(() => {
    const set = new Set<string>()
    if (Array.isArray(versionDocs)) {
      for (const doc of versionDocs) {
        if (doc && typeof doc === 'object' && '_id' in doc) {
          set.add((doc as {_id: string})._id)
        }
      }
    }
    return set
  }, [versionDocs])

  const dots = useMemo(
    () => buildStatusDots(baseId, existingIds, activeReleases),
    [activeReleases, baseId, existingIds],
  )

  return <StatusDots dots={dots} />
}
