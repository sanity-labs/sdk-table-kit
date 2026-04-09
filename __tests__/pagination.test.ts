import {column} from '@sanity-labs/react-table-kit'
import {renderHook, act} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useSanityTableData} from '../src/hooks/useSanityTableData'

// Mock @sanity/sdk-react
const mockFetchNextPage = vi.fn()
const mockFetchPreviousPage = vi.fn()
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

const mockArticles = Array.from({length: 25}, (_, i) => ({
  _id: `article-${i + 1}`,
  _type: 'article',
  title: `Article ${i + 1}`,
  _updatedAt: '2026-01-01',
}))

const testColumns = [column.title(), column.type(), column.updatedAt()]

describe('useSanityTableData — pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: true,
      hasPreviousPage: false,
      fetchNextPage: mockFetchNextPage,
      fetchPreviousPage: mockFetchPreviousPage,
      totalCount: 75,
      currentPage: 1,
      totalPages: 3,
    })
    mockUseQuery.mockReturnValue({
      data: mockArticles,
      isPending: false,
    })
  })

  it('Behavior 1: returns pagination state from SDK hook', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(result.current.pagination).toBeDefined()
    expect(result.current.pagination!.currentPage).toBe(1)
    expect(result.current.pagination!.totalPages).toBe(3)
    expect(result.current.pagination!.hasNextPage).toBe(true)
    expect(result.current.pagination!.hasPreviousPage).toBe(false)
  })

  it('Behavior 2: nextPage calls SDK fetchNextPage', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    act(() => {
      result.current.pagination!.nextPage()
    })

    expect(mockFetchNextPage).toHaveBeenCalled()
  })

  it('Behavior 3: previousPage calls SDK fetchPreviousPage', () => {
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: true,
      hasPreviousPage: true,
      fetchNextPage: mockFetchNextPage,
      fetchPreviousPage: mockFetchPreviousPage,
      totalCount: 75,
      currentPage: 2,
      totalPages: 3,
    })

    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    act(() => {
      result.current.pagination!.previousPage()
    })

    expect(mockFetchPreviousPage).toHaveBeenCalled()
  })

  it('Behavior 4: totalCount reflects SDK response', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(result.current.pagination!.totalCount).toBe(75)
  })

  it('Behavior 5: pagination is null in useQuery mode (array documentType)', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
      }),
    )

    expect(result.current.pagination).toBeNull()
  })

  it('Behavior 6: array documentType uses useQuery (no server-side pagination)', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: [],
        filter: '_id == "___never___"',
        pageSize: 1,
      }),
    )
  })

  it('Behavior 7: documentType without pageSize stays in query mode', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
      }),
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: [],
        filter: '_id == "___never___"',
        pageSize: 1,
      }),
    )
    expect(result.current.pagination).toBeNull()
  })

  it('Behavior 8: filter prop keeps server pagination when pageSize is provided', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'status != "archived"',
        pageSize: 10,
      }),
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'article',
        filter: 'status != "archived"',
        pageSize: 10,
      }),
    )
    expect(result.current.pagination).not.toBeNull()
  })
})
