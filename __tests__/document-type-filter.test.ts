import {column} from '@sanity-labs/react-table-kit'
import {renderHook} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {NuqsHookWrapper} from './hookWrappers'
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

import {useSanityTableData} from '../src/hooks/useSanityTableData'

const mockArticles = [
  {_id: 'article-1', _type: 'article', title: 'First', _updatedAt: '2026-01-01'},
  {_id: 'page-1', _type: 'page', title: 'Home', _updatedAt: '2026-01-02'},
]

const testColumns = [column.title(), column.type(), column.updatedAt()]

function getPrimaryQueryCall() {
  return [...mockUseQuery.mock.calls]
    .map((call) => call[0] as {params?: Record<string, unknown>; query: string})
    .reverse()
    .find((call) => !call.query.includes('_id in $documentIds'))
}

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

  it('Behavior 1: documentType as string without pageSize stays in query mode', () => {
    renderHook(
      () =>
        useSanityTableData({
          documentType: 'article',
          columns: testColumns,
        }),
      {wrapper: NuqsHookWrapper},
    )

    expect(mockUsePaginatedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: [],
        filter: '_id == "___never___"',
        pageSize: 1,
      }),
    )
    const callArgs = getPrimaryQueryCall()!
    expect(callArgs.query).toContain('_type == $docType')
    expect(callArgs.params).toEqual(expect.objectContaining({docType: 'article'}))
  })

  it('Behavior 2: documentType as string[] uses useQuery with _type in $docTypes', () => {
    renderHook(
      () =>
        useSanityTableData({
          documentType: ['article', 'page'],
          columns: testColumns,
        }),
      {wrapper: NuqsHookWrapper},
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = getPrimaryQueryCall()!
    expect(callArgs.query).toContain('_type in $docTypes')
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        docTypes: ['article', 'page'],
      }),
    )
  })

  it('Behavior 3: filter prop appends to base filter (single type)', () => {
    renderHook(
      () =>
        useSanityTableData({
          documentType: 'article',
          columns: testColumns,
          filter: 'status != "archived"',
        }),
      {wrapper: NuqsHookWrapper},
    )

    // With filter + single documentType, should use useQuery (can't add filter to usePaginatedDocuments)
    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = getPrimaryQueryCall()!
    expect(callArgs.query).toContain('_type == $docType')
    expect(callArgs.query).toContain('status != "archived"')
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        docType: 'article',
      }),
    )
  })

  it('Behavior 4: documentType[] + filter combines both', () => {
    renderHook(
      () =>
        useSanityTableData({
          documentType: ['article', 'page'],
          columns: testColumns,
          filter: 'defined(title)',
        }),
      {wrapper: NuqsHookWrapper},
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = getPrimaryQueryCall()!
    expect(callArgs.query).toContain('_type in $docTypes')
    expect(callArgs.query).toContain('defined(title)')
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        docTypes: ['article', 'page'],
      }),
    )
  })

  it('Behavior 5: projection is included in generated query', () => {
    renderHook(
      () =>
        useSanityTableData({
          documentType: ['article', 'page'],
          columns: testColumns,
        }),
      {wrapper: NuqsHookWrapper},
    )

    const callArgs = getPrimaryQueryCall()!
    // Should include the auto-generated projection
    expect(callArgs.query).toContain('{ _id, _type, title, _updatedAt }')
  })

  it('Behavior 6: single documentType without filter uses usePaginatedDocuments (server-side pagination)', () => {
    renderHook(
      () =>
        useSanityTableData({
          documentType: 'article',
          columns: testColumns,
          pageSize: 25,
        }),
      {wrapper: NuqsHookWrapper},
    )

    // No filter, single type → use usePaginatedDocuments for server-side pagination
    expect(mockUsePaginatedDocuments).toHaveBeenCalled()
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {documentIds: ['article-1', 'page-1']},
        query: '*[_id in $documentIds]{ _id, _type, title, _updatedAt }',
      }),
    )
  })
})
