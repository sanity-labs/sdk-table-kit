import {useActiveReleases, useClient} from '@sanity/sdk-react'
import {useQueryState, parseAsString} from 'nuqs'
import React, {createContext, useCallback, useContext, useEffect, useMemo} from 'react'

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

export interface ReleaseContextValue {
  /** All active releases */
  activeReleases: ReleaseDocument[]
  /** Currently selected release (null = drafts perspective) */
  selectedRelease: ReleaseDocument | null
  /** Currently selected release ID (the name field) */
  selectedReleaseId: string | null
  /** Set the active release (null to clear) */
  setSelectedReleaseId: (id: string | null) => void
  /** Get the perspective for SDK queries */
  getQueryPerspective: () => 'published' | [string, 'published']
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

  const selectedReleaseId = releaseParam || null

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
      setReleaseParam(id)
    },
    [setReleaseParam],
  )

  const getQueryPerspective = useCallback((): 'published' | [string, 'published'] => {
    if (!selectedReleaseId) return 'published'
    return [selectedReleaseId, 'published']
  }, [selectedReleaseId])

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
          // Strip drafts. prefix to get published ID
          const publishedId = docId.startsWith('drafts.') ? docId.slice(7) : docId
          const versionId = `versions.${releaseName}.${publishedId}`
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
      selectedRelease,
      selectedReleaseId,
      setSelectedReleaseId,
      getQueryPerspective,
      createRelease,
      addToRelease,
    }),
    [
      activeReleases,
      selectedRelease,
      selectedReleaseId,
      setSelectedReleaseId,
      getQueryPerspective,
      createRelease,
      addToRelease,
    ],
  )

  return <ReleaseContext.Provider value={value}>{children}</ReleaseContext.Provider>
}

export function useReleaseContext(): ReleaseContextValue {
  const ctx = useContext(ReleaseContext)
  console.log(
    '[useReleaseContext] ctx:',
    ctx ? 'found (' + ctx.activeReleases.length + ' releases)' : 'null — will throw',
  )
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
  const ctx = useContext(ReleaseContext)
  console.log(
    '[useOptionalReleaseContext] ctx:',
    ctx ? 'found (' + ctx.activeReleases.length + ' releases)' : 'null',
  )
  return ctx
}
