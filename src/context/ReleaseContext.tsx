import {useActiveReleases, useClient} from '@sanity/sdk-react'
import {useQueryState, parseAsString} from 'nuqs'
import React, {createContext, useCallback, useContext, useEffect, useMemo} from 'react'

import {buildVersionDocumentId, normalizeBaseDocumentId} from '../helpers/releases/documentIds'

/**
 * ReleaseDocument shape from @sanity/sdk.
 * Re-declared here to avoid importing from @sanity/sdk directly.
 */
export interface ReleaseDocument {
  _id: string
  name: string
  metadata: {
    title?: string
    releaseType?: 'asap' | 'scheduled' | 'undecided'
    intendedPublishAt?: string
    description?: string
  }
}

export interface CreateReleaseMetadata {
  title: string
  releaseType: 'asap' | 'scheduled' | 'undecided'
  description?: string
  intendedPublishAt?: string
}

export type ReleasePerspective =
  | {kind: 'drafts'}
  | {kind: 'published'}
  | {kind: 'release'; releaseId: string}

export const PUBLISHED_PERSPECTIVE_PARAM = '__published__'

export function parseReleasePerspectiveParam(value: string | null | undefined): ReleasePerspective {
  if (!value) return {kind: 'drafts'}
  if (value === PUBLISHED_PERSPECTIVE_PARAM) return {kind: 'published'}
  return {kind: 'release', releaseId: value}
}

export interface ReleaseContextValue {
  /** All active releases */
  activeReleases: ReleaseDocument[]
  /** Currently selected perspective */
  selectedPerspective: ReleasePerspective
  /** Currently selected staging target (null = drafts) */
  selectedRelease: ReleaseDocument | null
  /** Currently selected release ID (the name field) */
  selectedReleaseId: string | null
  /** Set the active release (null to clear) */
  setSelectedReleaseId: (id: string | null) => void
  /** Set the active perspective */
  setSelectedPerspective: (perspective: ReleasePerspective) => void
  /** Whether the published perspective is active */
  isPublishedPerspective: boolean
  /** Whether the drafts perspective is active */
  isDraftsPerspective: boolean
  /** Helper for consumers that want release-aware SDK reads */
  getQueryPerspective: () => 'published' | [string, 'published'] | undefined
  /** Create a new release */
  createRelease: (metadata: CreateReleaseMetadata) => Promise<void>
  /** Batch-add documents to a release */
  addToRelease: (documentIds: string[], releaseName: string) => Promise<void>
}

const ReleaseContext = createContext<ReleaseContextValue | null>(null)

function generateReleaseId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function ReleaseProvider({children}: {children: React.ReactNode}) {
  const sdkActiveReleases = useActiveReleases()
  const activeReleases = useMemo(
    () => (sdkActiveReleases ?? []) as ReleaseDocument[],
    [sdkActiveReleases],
  )
  const client = useClient({apiVersion: '2025-05-06'})
  const [releaseParam, setReleaseParam] = useQueryState('release', parseAsString.withDefault(''))

  const selectedPerspective = useMemo(
    () => parseReleasePerspectiveParam(releaseParam),
    [releaseParam],
  )
  const selectedReleaseId =
    selectedPerspective.kind === 'release' ? selectedPerspective.releaseId : null
  const isPublishedPerspective = selectedPerspective.kind === 'published'
  const isDraftsPerspective = selectedPerspective.kind === 'drafts'

  // Validate selected release still exists
  useEffect(() => {
    if (selectedReleaseId && activeReleases.length > 0) {
      const exists = activeReleases.some((r) => r.name === selectedReleaseId)
      if (!exists) {
        setReleaseParam(null)
      }
    }
  }, [selectedReleaseId, activeReleases, setReleaseParam])

  const selectedRelease = useMemo(() => {
    if (!selectedReleaseId) return null
    return activeReleases.find((r) => r.name === selectedReleaseId) ?? null
  }, [selectedReleaseId, activeReleases])

  const setSelectedReleaseId = useCallback(
    (id: string | null) => {
      setReleaseParam(id ?? null)
    },
    [setReleaseParam],
  )

  const setSelectedPerspective = useCallback(
    (perspective: ReleasePerspective) => {
      switch (perspective.kind) {
        case 'published':
          setReleaseParam(PUBLISHED_PERSPECTIVE_PARAM)
          return
        case 'release':
          setReleaseParam(perspective.releaseId)
          return
        case 'drafts':
        default:
          setReleaseParam(null)
      }
    },
    [setReleaseParam],
  )

  const getQueryPerspective = useCallback((): 'published' | [string, 'published'] | undefined => {
    if (selectedPerspective.kind === 'published') return 'published'
    if (selectedPerspective.kind === 'release') return [selectedPerspective.releaseId, 'published']
    return undefined
  }, [selectedPerspective])

  const createRelease = useCallback(
    async (metadata: CreateReleaseMetadata) => {
      const releaseId = generateReleaseId()
      await client.action({
        actionType: 'sanity.action.release.create',
        releaseId,
        metadata: {
          title: metadata.title,
          releaseType: metadata.releaseType,
          ...(metadata.description && {description: metadata.description}),
          ...(metadata.intendedPublishAt && {intendedPublishAt: metadata.intendedPublishAt}),
        },
      })
      setReleaseParam(releaseId)
    },
    [client, setReleaseParam],
  )

  const addToRelease = useCallback(
    async (documentIds: string[], releaseName: string) => {
      await Promise.all(
        documentIds.map((docId) => {
          const publishedId = normalizeBaseDocumentId(docId)
          const versionId = buildVersionDocumentId(publishedId, releaseName)
          return client.action({
            actionType: 'sanity.action.document.version.create',
            publishedId,
            baseId: publishedId,
            versionId,
          })
        }),
      )
    },
    [client],
  )

  const value = useMemo<ReleaseContextValue>(
    () => ({
      activeReleases,
      selectedPerspective,
      selectedRelease,
      selectedReleaseId,
      setSelectedReleaseId,
      setSelectedPerspective,
      isPublishedPerspective,
      isDraftsPerspective,
      getQueryPerspective,
      createRelease,
      addToRelease,
    }),
    [
      activeReleases,
      selectedPerspective,
      selectedRelease,
      selectedReleaseId,
      setSelectedReleaseId,
      setSelectedPerspective,
      isPublishedPerspective,
      isDraftsPerspective,
      getQueryPerspective,
      createRelease,
      addToRelease,
    ],
  )

  return <ReleaseContext.Provider value={value}>{children}</ReleaseContext.Provider>
}

export function useReleaseContext(): ReleaseContextValue {
  const ctx = useContext(ReleaseContext)
  if (!ctx) {
    throw new Error('useReleaseContext must be used within a ReleaseProvider')
  }
  return ctx
}

/**
 * Optional version — returns null if no ReleaseProvider is present.
 * Safe to use in components that may or may not be inside a ReleaseProvider.
 */
export function useOptionalReleaseContext(): ReleaseContextValue | null {
  return useContext(ReleaseContext)
}
