import {describe, it, expect, vi, beforeEach} from 'vitest'
import {renderHook} from '@testing-library/react'
import {column} from '@sanetti/sanity-table-kit'

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

import {useSanityTableData} from '../src/useSanityTableData'

const mockArticles = [
  {_id: 'article-1', _type: 'article', title: 'First', _updatedAt: '2026-01-01'},
  {_id: 'page-1', _type: 'page', title: 'Home', _updatedAt: '2026-01-02'},
]

const testColumns = [column.title(), column.type(), column.updatedAt()]

describe('useSanityTableData — documentType[] + filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: false,
      hasPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    mockUseQuery.mockReturnValue({
      data: mockArticles,
      isPending: false,
    })
  })

  it('Behavior 1: documentType as string uses usePaginatedDocuments (existing)', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
      }),
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({documentType: 'article'}),
    )
    expect(mockUseQuery).not.toHaveBeenCalled()
  })

  it('Behavior 2: documentType as string[] uses useQuery with _type in $docTypes', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.query).toContain('_type in $docTypes')
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        docTypes: ['article', 'page'],
      }),
    )
  })

  it('Behavior 3: filter prop appends to base filter (single type)', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'status != "archived"',
      }),
    )

    // With filter + single documentType, should use useQuery (can't add filter to usePaginatedDocuments)
    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.query).toContain('_type == $docType')
    expect(callArgs.query).toContain('status != "archived"')
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        docType: 'article',
      }),
    )
  })

  it('Behavior 4: documentType[] + filter combines both', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
        filter: 'defined(title)',
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.query).toContain('_type in $docTypes')
    expect(callArgs.query).toContain('defined(title)')
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        docTypes: ['article', 'page'],
      }),
    )
  })

  it('Behavior 5: projection is included in generated query', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
      }),
    )

    const callArgs = mockUseQuery.mock.calls[0][0]
    // Should include the auto-generated projection
    expect(callArgs.query).toContain('{ _id, _type, title, _updatedAt }')
  })

  it('Behavior 6: single documentType without filter uses usePaginatedDocuments (server-side pagination)', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    // No filter, single type → use usePaginatedDocuments for server-side pagination
    expect(mockUsePaginatedDocuments).toHaveBeenCalled()
    expect(mockUseQuery).not.toHaveBeenCalled()
  })
})
