import {describe, it, expect, vi, beforeEach} from 'vitest'

// Track what args each hook receives
const mockUsePaginatedDocuments = vi.fn(() => ({
  data: [],
  isPending: false,
  currentPage: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  totalCount: 0,
  fetchNextPage: vi.fn(),
  fetchPreviousPage: vi.fn(),
}))

const mockUseQuery = vi.fn(() => ({
  data: [],
  isPending: false,
}))

vi.mock('@sanity/sdk-react', () => ({
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

import {useSanityTableData} from '../src/useSanityTableData'
import {renderHook} from '@testing-library/react'

const baseColumns = [
  {id: 'title', header: 'Title', field: 'title'},
  {id: 'status', header: 'Status', field: 'status'},
]

describe('R-T2: Perspective injection into useSanityTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Behavior 1 [TRACER]: passes perspective to usePaginatedDocuments', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: baseColumns,
        perspective: ['spring-campaign', 'published'],
      }),
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        perspective: ['spring-campaign', 'published'],
      }),
    )
  })

  it('Behavior 2: passes perspective to useQuery in query mode', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'blogPost'],
        columns: baseColumns,
        perspective: ['cyber-monday', 'published'],
      }),
    )

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        perspective: ['cyber-monday', 'published'],
      }),
    )
  })

  it('Behavior 3: passes perspective to useQuery when filter is present', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        filter: 'status != "archived"',
        columns: baseColumns,
        perspective: 'published',
      }),
    )

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        perspective: 'published',
      }),
    )
  })

  it('Behavior 4: omits perspective when not provided (backward compat)', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: baseColumns,
      }),
    )

    const callArgs = mockUsePaginatedDocuments.mock.calls[0][0]
    expect(callArgs.perspective).toBeUndefined()
  })
})
