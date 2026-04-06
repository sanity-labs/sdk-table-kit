import {renderHook, act} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {column} from '../src'
import {useSanityTableData} from '../src/hooks/useSanityTableData'

// Mock @sanity/sdk-react
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

const mockArticles = [
  {_id: 'article-1', _type: 'article', title: 'Alpha', _updatedAt: '2026-01-01'},
  {_id: 'article-2', _type: 'article', title: 'Beta', _updatedAt: '2026-01-02'},
]

const testColumns = [column.title(), column.type(), column.updatedAt()]

describe('useSanityTableData — sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: false,
      hasPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      totalCount: 2,
      currentPage: 1,
      totalPages: 1,
    })
    mockUseQuery.mockReturnValue({
      data: mockArticles,
      isPending: false,
    })
  })

  it('Behavior 1: defaultSort is passed as orderings to usePaginatedDocuments', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
        defaultSort: {field: '_updatedAt', direction: 'desc'},
      }),
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        orderings: [{field: '_updatedAt', direction: 'desc'}],
      }),
    )
  })

  it('Behavior 2: onSortChange updates orderings on next render', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(result.current.sorting).toBeDefined()
    expect(result.current.sorting!.current).toBeNull()

    act(() => {
      result.current.sorting!.onSortChange({field: 'title', direction: 'asc'})
    })

    // After state update, the hook should re-call usePaginatedDocuments with new orderings
    expect(mockUsePaginatedDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderings: [{field: 'title', direction: 'asc'}],
      }),
    )
  })

  it('Behavior 3: sort state returned with current and onSortChange', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
        defaultSort: {field: 'title', direction: 'asc'},
      }),
    )

    expect(result.current.sorting).toBeDefined()
    expect(result.current.sorting!.current).toEqual({field: 'title', direction: 'asc'})
    expect(typeof result.current.sorting!.onSortChange).toBe('function')
  })

  it('Behavior 4: sorting is null in useQuery mode (client-side sorting)', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
      }),
    )

    // In query mode (array documentType), sorting is handled client-side by DocumentTable
    expect(result.current.sorting).toBeNull()
  })

  it('Behavior 5: filtered paginated tables still expose server sorting', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'status != "archived"',
        pageSize: 25,
      }),
    )

    act(() => {
      result.current.sorting!.onSortChange({field: 'title', direction: 'asc'})
    })

    expect(result.current.sorting).not.toBeNull()
    expect(mockUsePaginatedDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: 'status != "archived"',
        orderings: [{field: 'title', direction: 'asc'}],
      }),
    )
  })

  it('Behavior 6: clearing sort sets orderings to undefined', () => {
    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
        defaultSort: {field: 'title', direction: 'asc'},
      }),
    )

    act(() => {
      result.current.sorting!.onSortChange(null)
    })

    expect(result.current.sorting!.current).toBeNull()
    expect(mockUsePaginatedDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderings: undefined,
      }),
    )
  })

  it('Behavior 7: reference columns can map UI sort to a server-side sort field', () => {
    const columns = [
      column.reference({
        field: 'section',
        header: 'Section',
        referenceType: 'section',
        preview: {
          select: {name: 'name'},
          prepare: ({name}) => ({title: name}),
        },
        sortField: 'section->name',
        sortable: true,
      }),
    ]

    const {result} = renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns,
        pageSize: 25,
      }),
    )

    act(() => {
      result.current.sorting!.onSortChange({field: 'section', direction: 'asc'})
    })

    expect(result.current.sorting!.current).toEqual({field: 'section', direction: 'asc'})
    expect(mockUsePaginatedDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderings: [{field: 'section->name', direction: 'asc'}],
      }),
    )
  })
})
