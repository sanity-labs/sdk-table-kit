import {useQuery, useActiveReleases} from '@sanity/sdk-react'
import {Box, Flex, Text, Tooltip, Stack} from '@sanity/ui'
import React, {useMemo} from 'react'

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

/**
 * Renders document status dots with tooltip.
 *
 * Uses `sanity::versionOf()` GROQ function to find ALL versions of a document
 * (published, draft, and release versions) in a single query.
 * Requires perspective: 'raw' and apiVersion >= 2025-02-19.
 */
export function DocumentStatusCell({
  documentId,
  documentType,
}: {
  documentId: string
  documentType: string
}) {
  // Strip any prefix to get the published base ID
  let baseId = documentId
  if (baseId.startsWith('drafts.')) {
    baseId = baseId.slice(7)
  } else if (baseId.startsWith('versions.')) {
    const parts = baseId.split('.')
    baseId = parts.slice(2).join('.')
  }

  // Always fetch active releases directly — works with or without ReleaseProvider
  const activeReleases = useActiveReleases()

  // Use sanity::versionOf() to find ALL versions of this document
  // This returns published, drafts.*, and versions.*.* documents
  const {data: versionDocs} = useQuery({
    query: `*[sanity::versionOf($publishedId)]{ _id, _updatedAt }`,
    params: {publishedId: baseId},
    perspective: 'raw' as unknown as undefined,
  })

  // Build set of existing IDs
  const existingIds = useMemo(() => {
    const set = new Set<string>()
    if (Array.isArray(versionDocs)) {
      for (const doc of versionDocs) {
        if (doc && typeof doc === 'object' && '_id' in doc) {
          set.add((doc as {_id: string})._id)
        }
      }
    }
    console.log('[DocumentStatusCell]', baseId, 'versions found:', [...set])
    return set
  }, [versionDocs, baseId])

  // Build a map of release name → release for quick lookup
  const releaseMap = useMemo(() => {
    const map = new Map<string, (typeof activeReleases)[number]>()
    for (const r of activeReleases) {
      map.set(r.name, r)
    }
    return map
  }, [activeReleases])

  // Build dots array in order: published → draft → ASAP → scheduled → undecided
  const dots: StatusDot[] = []

  if (existingIds.has(baseId)) {
    dots.push({color: STATUS_COLORS.published, label: 'Published'})
  }
  if (existingIds.has(`drafts.${baseId}`)) {
    dots.push({color: STATUS_COLORS.draft, label: 'Draft'})
  }

  // Check each existing version ID against active releases, grouped by type
  const releaseDots: Array<StatusDot & {type: string}> = []
  for (const id of existingIds) {
    if (!id.startsWith('versions.')) continue
    // Extract release name: versions.<releaseName>.<docId>
    const withoutPrefix = id.slice('versions.'.length)
    const dotIndex = withoutPrefix.indexOf('.')
    if (dotIndex === -1) continue
    const releaseName = withoutPrefix.slice(0, dotIndex)
    const release = releaseMap.get(releaseName)
    if (release) {
      const type = release.metadata.releaseType
      releaseDots.push({
        color: STATUS_COLORS[type as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.muted,
        label: release.metadata.title,
        type,
      })
    }
  }

  // Sort release dots by type order: asap → scheduled → undecided
  const typeOrder = ['asap', 'scheduled', 'undecided']
  releaseDots.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))
  dots.push(...releaseDots)

  console.log(
    '[DocumentStatusCell]',
    baseId,
    'dots built:',
    dots.map((d) => d.label),
    'from existingIds:',
    [...existingIds],
    'activeReleases:',
    activeReleases.map((r) => r.name),
    'releaseMap keys:',
    [...releaseMap.keys()],
  )

  // Fallback: if no dots at all, show muted "New" dot
  if (dots.length === 0) {
    dots.push({color: STATUS_COLORS.muted, label: 'New'})
  }

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
