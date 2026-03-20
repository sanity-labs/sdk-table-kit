import {column} from '@sanetti/sanity-table-kit'
import {renderHook} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useSanityTableData} from '../src/useSanityTableData'

// Mock @sanity/sdk-react
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

const mockArticles = [
  {_id: 'article-1', _type: 'article', title: 'First Article', _updatedAt: '2026-01-01'},
  {_id: 'article-2', _type: 'article', title: 'Second Article', _updatedAt: '2026-01-02'},
  {_id: 'article-3', _type: 'article', title: 'Third Article', _updatedAt: '2026-01-03'},
]

const testColumns = [column.title(), column.type(), column.updatedAt()]

describe('useSanityTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: usePaginatedDocuments returns data
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: false,
      hasPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    // Default mock: useQuery returns data
    mockUseQuery.mockReturnValue({
      data: mockArticles,
      isPending: false,
    })
  })

  it('Behavior 1: calls usePaginatedDocuments with correct type and projection', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'article',
        pageSize: 25,
      }),
    )
    // Should NOT call useQuery when documentType is provided with pageSize
    expect(mockUseQuery).not.toHaveBeenCalled()
  })

  it('Behavior 2: returns data array from SDK hook response', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(result.current.data).toEqual(mockArticles)
    expect(result.current.data).toHaveLength(3)
  })

  it('Behavior 3: returns loading state mapped from SDK isPending', () => {
    mockUsePaginatedDocuments.mockReturnValue({
      data: undefined,
      isPending: true,
      hasNextPage: false,
      hasPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })

    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(result.current.loading).toBe(true)
  })

  it('Behavior 4: uses useQuery when documentType is an array', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    expect(mockUsePaginatedDocuments).not.toHaveBeenCalled()
  })

  it('Behavior 5: uses useQuery when filter prop is provided', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'status != "archived"',
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.query).toContain('status != "archived"')
    expect(callArgs.params).toEqual(expect.objectContaining({docType: 'article'}))
  })

  it('Behavior 6: auto-generates projection from columns', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    // The projection should be passed to the SDK hook
    const callArgs = mockUsePaginatedDocuments.mock.calls[0][0]
    expect(callArgs.projection).toBe('{ _id, _type, title, _updatedAt }')
  })

  it('Behavior 7: projection override bypasses auto-generation', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
        projection: '{ _id, title, customField }',
      }),
    )

    const callArgs = mockUsePaginatedDocuments.mock.calls[0][0]
    expect(callArgs.projection).toBe('{ _id, title, customField }')
  })

  it('Behavior 8: forwards pageSize to usePaginatedDocuments', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 50,
      }),
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 50,
      }),
    )
  })

  it('Behavior 9: defaults pageSize to 25 when not specified but documentType is', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
      }),
    )

    // With documentType and no explicit pageSize, should still use paginated with default 25
    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 25,
      }),
    )
  })
})
