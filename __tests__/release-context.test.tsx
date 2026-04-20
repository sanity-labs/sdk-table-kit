import {renderHook, act} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {
  PUBLISHED_PERSPECTIVE_PARAM,
  ReleaseProvider,
  useReleaseContext,
} from '../src/context/ReleaseContext'

// Mock @sanity/sdk-react
const mockActiveReleases = vi.fn()
const mockClient = {
  action: vi.fn().mockResolvedValue({}),
  config: () => ({projectId: 'test', dataset: 'production'}),
}
const mockUseClient = vi.fn(() => mockClient)

vi.mock('@sanity/sdk-react', () => ({
  useActiveReleases: () => mockActiveReleases(),
  useClient: (...args: unknown[]) => mockUseClient(...args),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

// Mock nuqs
const mockSetRelease = vi.fn()
let mockReleaseParam: string | null = null
vi.mock('nuqs', () => ({
  useQueryState: () => [mockReleaseParam, mockSetRelease],
  parseAsString: {withDefault: (d: string) => d},
}))

const asapRelease = {
  _id: '_.releases.spring-campaign',
  _type: 'system.release' as const,
  name: 'spring-campaign',
  state: 'active' as const,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev1',
  metadata: {
    title: 'Spring Campaign',
    releaseType: 'asap' as const,
    description: 'ASAP release for spring',
  },
}

const scheduledRelease = {
  _id: '_.releases.cyber-monday',
  _type: 'system.release' as const,
  name: 'cyber-monday',
  state: 'active' as const,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev2',
  metadata: {
    title: 'Cyber Monday',
    releaseType: 'scheduled' as const,
    intendedPublishAt: '2026-11-30T00:00:00Z',
  },
}

const undecidedRelease = {
  _id: '_.releases.untitled',
  _type: 'system.release' as const,
  name: 'untitled',
  state: 'active' as const,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev3',
  metadata: {
    title: 'Untitled release',
    releaseType: 'undecided' as const,
  },
}

const allReleases = [asapRelease, scheduledRelease, undecidedRelease]

function wrapper({children}: {children: React.ReactNode}) {
  return <ReleaseProvider>{children}</ReleaseProvider>
}

describe('useReleaseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveReleases.mockReturnValue(allReleases)
    mockReleaseParam = null
  })

  it('Behavior 1 [TRACER]: returns activeReleases from useActiveReleases()', () => {
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    expect(result.current.activeReleases).toEqual(allReleases)
    expect(result.current.activeReleases).toHaveLength(3)
  })

  it('Behavior 2: setSelectedReleaseId updates selectedRelease', () => {
    mockReleaseParam = 'spring-campaign'
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    expect(result.current.selectedRelease).toEqual(asapRelease)
    expect(result.current.selectedReleaseId).toBe('spring-campaign')
  })

  it('Behavior 3: drafts is the default perspective when no release is selected', () => {
    mockReleaseParam = null
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    expect(result.current.selectedPerspective).toEqual({kind: 'drafts'})
    expect(result.current.isDraftsPerspective).toBe(true)
    expect(result.current.isPublishedPerspective).toBe(false)
    expect(result.current.getQueryPerspective()).toBeUndefined()
  })

  it('Behavior 4: getQueryPerspective returns [releaseName, published] when release selected', () => {
    mockReleaseParam = 'spring-campaign'
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    expect(result.current.getQueryPerspective()).toEqual(['spring-campaign', 'published'])
  })

  it('Behavior 4b: published perspective is addressable separately from drafts', () => {
    mockReleaseParam = PUBLISHED_PERSPECTIVE_PARAM
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    expect(result.current.selectedPerspective).toEqual({kind: 'published'})
    expect(result.current.isPublishedPerspective).toBe(true)
    expect(result.current.getQueryPerspective()).toBe('published')
  })

  it('Behavior 5: selectedReleaseId clears if release no longer exists', () => {
    mockReleaseParam = 'deleted-release'
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    // Release not in activeReleases — should be null
    expect(result.current.selectedRelease).toBeNull()
    expect(mockSetRelease).toHaveBeenCalledWith(null)
  })

  it('Behavior 6: createRelease calls client.action with correct payload', async () => {
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    await act(async () => {
      await result.current.createRelease({
        title: 'New Release',
        releaseType: 'asap',
      })
    })
    expect(mockClient.action).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'sanity.action.release.create',
        metadata: expect.objectContaining({
          title: 'New Release',
          releaseType: 'asap',
        }),
      }),
    )
  })

  it('Behavior 7: addToRelease batch-creates version documents', async () => {
    mockReleaseParam = 'spring-campaign'
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    await act(async () => {
      await result.current.addToRelease(['doc1', 'doc2'], 'spring-campaign')
    })
    expect(mockClient.action).toHaveBeenCalledTimes(2)
    expect(mockClient.action).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'sanity.action.document.version.create',
        publishedId: 'doc1',
        versionId: 'versions.spring-campaign.doc1',
      }),
    )
    expect(mockClient.action).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'sanity.action.document.version.create',
        publishedId: 'doc2',
        versionId: 'versions.spring-campaign.doc2',
      }),
    )
  })

  it('Behavior 8: release client uses the pinned apiVersion', () => {
    renderHook(() => useReleaseContext(), {wrapper})
    expect(mockUseClient).toHaveBeenCalledWith({apiVersion: '2025-05-06'})
  })

  it('Behavior 9: setSelectedPerspective stores the published sentinel in URL state', () => {
    const {result} = renderHook(() => useReleaseContext(), {wrapper})
    act(() => {
      result.current.setSelectedPerspective({kind: 'published'})
    })
    expect(mockSetRelease).toHaveBeenCalledWith(PUBLISHED_PERSPECTIVE_PARAM)
  })
})
