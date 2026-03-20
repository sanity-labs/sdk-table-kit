import {column} from '@sanetti/sanity-table-kit'
import {renderHook, act} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useSDKEditHandler} from '../src/useSDKEditHandler'

// Mock @sanity/sdk-react
const mockEditDocument = vi.fn()
const mockUseEditDocument = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useEditDocument: (...args: unknown[]) => mockUseEditDocument(...args),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

describe('useSDKEditHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEditDocument.mockResolvedValue(undefined)
    mockUseEditDocument.mockReturnValue({
      edit: mockEditDocument,
    })
  })

  it('Behavior 1: creates an onSave handler that calls useEditDocument', async () => {
    const {result} = renderHook(() => useSDKEditHandler())

    const doc = {_id: 'doc-1', _type: 'article', title: 'Old Title'}

    await act(async () => {
      await result.current.handleEdit(doc, 'title', 'New Title')
    })

    expect(mockUseEditDocument).toHaveBeenCalled()
    expect(mockEditDocument).toHaveBeenCalledWith({
      documentId: 'doc-1',
      field: 'title',
      value: 'New Title',
    })
  })

  it('Behavior 2: handles select mode edits', async () => {
    const {result} = renderHook(() => useSDKEditHandler())

    const doc = {_id: 'doc-1', _type: 'article', status: 'draft'}

    await act(async () => {
      await result.current.handleEdit(doc, 'status', 'published')
    })

    expect(mockEditDocument).toHaveBeenCalledWith({
      documentId: 'doc-1',
      field: 'status',
      value: 'published',
    })
  })

  it('Behavior 3: handles date mode edits', async () => {
    const {result} = renderHook(() => useSDKEditHandler())

    const doc = {_id: 'doc-1', _type: 'article', publishDate: '2026-01-01'}

    await act(async () => {
      await result.current.handleEdit(doc, 'publishDate', '2026-06-15')
    })

    expect(mockEditDocument).toHaveBeenCalledWith({
      documentId: 'doc-1',
      field: 'publishDate',
      value: '2026-06-15',
    })
  })

  it('Behavior 4: returns error state on failure', async () => {
    mockEditDocument.mockRejectedValue(new Error('Permission denied'))

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

    expect(mockEditDocument).toHaveBeenCalledWith({
      documentId: 'doc-1',
      field: 'title',
      value: 'New Title',
    })
  })
})
