import {renderHook, act} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useSDKEditHandler} from '../src/hooks/useSDKEditHandler'

const mockApply = vi.fn()
const mockEditDocument = vi.fn()
const mockPatchDocumentInRelease = vi.fn()
let mockHasSelectedRelease = false

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => mockApply,
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: (...args: unknown[]) => mockEditDocument(...args),
}))

vi.mock('../src/hooks/useReleaseDocumentMutations', () => ({
  useReleaseDocumentMutations: () => ({
    hasSelectedRelease: mockHasSelectedRelease,
    patchDocumentInRelease: (...args: unknown[]) => mockPatchDocumentInRelease(...args),
    resolveReleaseDocumentId: vi.fn(),
    selectedReleaseId: mockHasSelectedRelease ? 'spring' : null,
  }),
}))

describe('useSDKEditHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasSelectedRelease = false
    mockApply.mockResolvedValue(undefined)
    mockPatchDocumentInRelease.mockResolvedValue('versions.spring.doc-1')
    mockEditDocument.mockImplementation((document, patches) => ({
      document,
      patches,
      type: 'document.edit',
    }))
  })

  it('Behavior 1: creates an onSave handler that dispatches a document edit action', async () => {
    const {result} = renderHook(() => useSDKEditHandler())

    const doc = {_id: 'doc-1', _type: 'article', title: 'Old Title'}

    await act(async () => {
      await result.current.handleEdit(doc, 'title', 'New Title')
    })

    expect(mockEditDocument).toHaveBeenCalledWith(
      {documentId: 'doc-1', documentType: 'article'},
      {set: {title: 'New Title'}},
    )
    expect(mockApply).toHaveBeenCalledWith({
      document: {documentId: 'doc-1', documentType: 'article'},
      patches: {set: {title: 'New Title'}},
      type: 'document.edit',
    })
  })

  it('Behavior 2: handles select mode edits', async () => {
    const {result} = renderHook(() => useSDKEditHandler())

    const doc = {_id: 'doc-1', _type: 'article', status: 'draft'}

    await act(async () => {
      await result.current.handleEdit(doc, 'status', 'published')
    })

    expect(mockEditDocument).toHaveBeenCalledWith(
      {documentId: 'doc-1', documentType: 'article'},
      {set: {status: 'published'}},
    )
  })

  it('Behavior 3: handles date mode edits', async () => {
    const {result} = renderHook(() => useSDKEditHandler())

    const doc = {_id: 'doc-1', _type: 'article', publishDate: '2026-01-01'}

    await act(async () => {
      await result.current.handleEdit(doc, 'publishDate', '2026-06-15')
    })

    expect(mockEditDocument).toHaveBeenCalledWith(
      {documentId: 'doc-1', documentType: 'article'},
      {set: {publishDate: '2026-06-15'}},
    )
  })

  it('Behavior 4: returns error state on failure', async () => {
    mockApply.mockRejectedValue(new Error('Permission denied'))

    const {result} = renderHook(() => useSDKEditHandler())

    const doc = {_id: 'doc-1', _type: 'article', title: 'Old'}

    let error: Error | null = null
    await act(async () => {
      try {
        await result.current.handleEdit(doc, 'title', 'New')
      } catch (e) {
        error = e as Error
      }
    })

    expect(error).toBeDefined()
    expect(error!.message).toBe('Permission denied')
  })

  it('Behavior 5: createOnSave wraps handleEdit for a specific field', () => {
    const {result} = renderHook(() => useSDKEditHandler())

    const onSave = result.current.createOnSave('title')
    expect(typeof onSave).toBe('function')

    // onSave should be a function that takes (doc, newValue)
    const doc = {_id: 'doc-1', _type: 'article', title: 'Old'}
    onSave(doc, 'New Title')

    expect(mockEditDocument).toHaveBeenCalledWith(
      {documentId: 'doc-1', documentType: 'article'},
      {set: {title: 'New Title'}},
    )
  })

  it('Behavior 6: routes edits through release patching when a release is selected', async () => {
    mockHasSelectedRelease = true

    const {result} = renderHook(() => useSDKEditHandler())
    const doc = {_id: 'doc-1', _type: 'article', title: 'Old'}

    await act(async () => {
      await result.current.handleEdit(doc, 'title', 'Staged Title')
    })

    expect(mockPatchDocumentInRelease).toHaveBeenCalledWith('doc-1', {
      set: {title: 'Staged Title'},
    })
    expect(mockEditDocument).not.toHaveBeenCalled()
    expect(mockApply).not.toHaveBeenCalled()
  })
})
