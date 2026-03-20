import {renderHook, act} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useCreateDocument} from '../src/useCreateDocument'

// Mock SDK
const mockApply = vi.fn().mockResolvedValue(undefined)
vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => mockApply,
  useCurrentUser: () => ({
    id: 'user-1',
    name: 'Test',
    roles: [{name: 'administrator', title: 'Administrator'}],
  }),
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn((handle: unknown, initialValue?: unknown) => ({
    type: 'createDocument',
    handle,
    initialValue,
  })),
}))

// Mock release context with active release
const mockReleaseCtx = {selectedReleaseId: null as string | null}
vi.mock('../src/ReleaseContext', () => ({
  useOptionalReleaseContext: () => (mockReleaseCtx.selectedReleaseId ? mockReleaseCtx : null),
}))
vi.mock('../src/useSafeToast', () => ({
  useSafeToast: () => ({push: vi.fn()}),
}))

import {createDocument} from '@sanity/sdk'

beforeEach(() => {
  vi.clearAllMocks()
  mockReleaseCtx.selectedReleaseId = null
})

describe('useCreateDocument — release-aware', () => {
  it('Behavior 1: creates drafts document when no release active', async () => {
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    await act(async () => {
      await result.current.create()
    })
    expect(createDocument).toHaveBeenCalledWith({documentType: 'article'}, undefined)
  })

  it('Behavior 2: creates document when release is active', async () => {
    mockReleaseCtx.selectedReleaseId = 'summer-launch'
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    await act(async () => {
      await result.current.create()
    })
    expect(createDocument).toHaveBeenCalled()
    expect(mockApply).toHaveBeenCalledTimes(1)
  })

  it('Behavior 3: merges initialValues in release mode', async () => {
    mockReleaseCtx.selectedReleaseId = 'summer-launch'
    const {result} = renderHook(() =>
      useCreateDocument({
        documentType: 'article',
        initialValues: {status: 'draft'},
        activeFilters: {section: 'sports'},
      }),
    )
    await act(async () => {
      await result.current.create()
    })
    expect(createDocument).toHaveBeenCalledWith(
      {documentType: 'article'},
      {status: 'draft', section: 'sports'},
    )
  })

  it('Behavior 4: falls back to drafts when selectedReleaseId is null', async () => {
    mockReleaseCtx.selectedReleaseId = null
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    await act(async () => {
      await result.current.create()
    })
    expect(createDocument).toHaveBeenCalledWith({documentType: 'article'}, undefined)
  })
})
