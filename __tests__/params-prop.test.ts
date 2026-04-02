import {column} from '@sanetti/sanity-table-kit'
import {renderHook} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import type {SanityDocumentTableProps} from '../src/components/table/SanityDocumentTable'
import type {SanityTableDataConfig} from '../src/hooks/useSanityTableData'
import {useSanityTableData} from '../src/hooks/useSanityTableData'

// Mock @sanity/sdk-react
const mockUseQuery = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  usePaginatedDocuments: vi.fn().mockReturnValue({
    data: [],
    isPending: false,
    hasNextPage: false,
    hasPreviousPage: false,
    fetchNextPage: vi.fn(),
    fetchPreviousPage: vi.fn(),
  }),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

const testColumns = [column.title(), column.type(), column.updatedAt()]

describe('useSanityTableData — params prop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuery.mockReturnValue({
      data: [],
      isPending: false,
    })
  })

  // B0.1 — SanityDocumentTableProps accepts an optional params: Record<string, unknown> prop
  it('B0.1: SanityDocumentTableProps accepts an optional params prop', () => {
    // Type-level test: this should compile without errors
    const props: SanityDocumentTableProps = {
      documentType: 'article',
      columns: testColumns,
      params: {userId: 'abc123'},
    }
    expect(props.params).toEqual({userId: 'abc123'})
  })

  // B0.2 — SanityTableDataConfig accepts an optional params: Record<string, unknown> prop
  it('B0.2: SanityTableDataConfig accepts an optional params prop', () => {
    // Type-level test: this should compile without errors
    const config: SanityTableDataConfig = {
      documentType: 'article',
      columns: testColumns,
      params: {userId: 'abc123'},
    }
    expect(config.params).toEqual({userId: 'abc123'})
  })

  // B0.3 — buildQuery() merges user-provided params with the internal docType/docTypes params
  it('B0.3: merges user params with internal docType param', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'assignee == $userId',
        params: {userId: 'abc123'},
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        userId: 'abc123',
        docType: 'article',
      }),
    )
  })

  // B0.3 (array variant) — merges user params with docTypes for array documentType
  it('B0.3: merges user params with internal docTypes param (array)', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
        params: {userId: 'abc123'},
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        userId: 'abc123',
        docTypes: ['article', 'page'],
      }),
    )
  })

  // B0.4 — User params do NOT override internal params ($docType is always set by the table)
  it('B0.4: internal docType takes precedence over user-supplied docType', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'defined(title)',
        params: {docType: 'SHOULD_BE_OVERRIDDEN', userId: 'abc123'},
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    // Internal docType must win over user-supplied docType
    expect(callArgs.params.docType).toBe('article')
    // User param should still be present
    expect(callArgs.params.userId).toBe('abc123')
  })

  // B0.4 (array variant) — User params do NOT override internal docTypes
  it('B0.4: internal docTypes takes precedence over user-supplied docTypes', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
        params: {docTypes: ['SHOULD_BE_OVERRIDDEN'], userId: 'abc123'},
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    // Internal docTypes must win over user-supplied docTypes
    expect(callArgs.params.docTypes).toEqual(['article', 'page'])
    expect(callArgs.params.userId).toBe('abc123')
  })

  // B0.5 — When params is undefined, behavior is unchanged (backwards compatible)
  it('B0.5: when params is undefined, behavior is unchanged', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: ['article', 'page'],
        columns: testColumns,
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.params).toEqual({docTypes: ['article', 'page']})
  })

  // B0.5 (single type variant)
  it('B0.5: when params is undefined with single type + filter, only docType is in params', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'defined(title)',
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    expect(callArgs.params).toEqual({docType: 'article'})
  })

  // B0.6 — A filter using $userId with params={{ userId: 'abc123' }} correctly passes the param to useQuery
  it('B0.6: filter using $userId with params passes correctly to useQuery', () => {
    renderHook(() =>
      useSanityTableData({
        documentType: 'article',
        columns: testColumns,
        filter: 'assignee._ref == $userId',
        params: {userId: 'abc123'},
      }),
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const callArgs = mockUseQuery.mock.calls[0][0]
    // Query should contain the filter
    expect(callArgs.query).toContain('assignee._ref == $userId')
    // Params should contain both userId and docType
    expect(callArgs.params).toEqual(
      expect.objectContaining({
        userId: 'abc123',
        docType: 'article',
      }),
    )
  })
})
