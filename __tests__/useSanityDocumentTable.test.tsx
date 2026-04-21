import {column, DocumentTable} from '@sanity-labs/react-table-kit'
import {renderHook} from '@testing-library/react'
import {screen} from '@testing-library/react'
import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {PaginationControls} from '../src/components/table/PaginationControls'
import {useSanityDocumentTable} from '../src/hooks/useSanityDocumentTable'
import {renderWithTheme} from './helpers'

// Mock @sanity/sdk-react
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()
const mockClient = {
  config: () => ({projectId: 'test', dataset: 'production'}),
  fetch: vi.fn().mockResolvedValue(null),
  releases: {
    fetchDocuments: vi.fn().mockResolvedValue([]),
  },
}

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useDocumentProjection: () => ({data: null}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useActiveReleases: () => [],
  useClient: () => mockClient,
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

// Mock window.matchMedia for Sanity UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockArticles = [
  {_id: 'article-1', _type: 'article', title: 'First', _updatedAt: '2026-01-01'},
  {_id: 'article-2', _type: 'article', title: 'Second', _updatedAt: '2026-01-02'},
]
const mockHandles = mockArticles.map((article) => ({
  documentId: article._id,
  documentType: article._type,
}))

const testColumns = [column.title(), column.updatedAt()]

function NuqsWrapper({children}: {children: React.ReactNode}) {
  return <NuqsTestingAdapter hasMemory>{children}</NuqsTestingAdapter>
}

describe('useSanityDocumentTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockHandles,
      isPending: false,
      hasNextPage: true,
      hasPreviousPage: false,
      count: 50,
      currentPage: 1,
      nextPage: vi.fn(),
      pageSize: 25,
      previousPage: vi.fn(),
      setPageSize: vi.fn(),
      totalPages: 2,
    })
    mockUseQuery.mockReturnValue({
      data: mockArticles,
      isPending: false,
    })
  })

  it('Behavior 1: returns tableProps with data, columns, loading', () => {
    const {result} = renderHook(
      () =>
        useSanityDocumentTable({
          documentType: 'article',
          columns: testColumns,
          pageSize: 25,
        }),
      {wrapper: NuqsWrapper},
    )

    expect(result.current.tableProps).toBeDefined()
    expect(result.current.tableProps.data).toEqual(mockArticles)
    expect(result.current.tableProps.columns).toEqual(testColumns)
    expect(result.current.tableProps.loading).toBe(false)
  })

  it('Behavior 2: returns paginationProps with pagination and loading', () => {
    const {result} = renderHook(
      () =>
        useSanityDocumentTable({
          documentType: 'article',
          columns: testColumns,
          pageSize: 25,
        }),
      {wrapper: NuqsWrapper},
    )

    expect(result.current.paginationProps).toBeDefined()
    expect(result.current.paginationProps.pagination.currentPage).toBe(1)
    expect(result.current.paginationProps.pagination.pageSize).toBe(25)
    expect(result.current.paginationProps.pagination.totalPages).toBe(2)
    expect(result.current.paginationProps.loading).toBe(false)
  })

  it('Behavior 3: tableProps spreadable onto DocumentTable', () => {
    const {result} = renderHook(
      () =>
        useSanityDocumentTable({
          documentType: 'article',
          columns: testColumns,
          pageSize: 25,
        }),
      {wrapper: NuqsWrapper},
    )

    renderWithTheme(<DocumentTable {...result.current.tableProps} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('Behavior 4: paginationProps spreadable onto PaginationControls', () => {
    const {result} = renderHook(
      () =>
        useSanityDocumentTable({
          documentType: 'article',
          columns: testColumns,
          pageSize: 25,
        }),
      {wrapper: NuqsWrapper},
    )

    renderWithTheme(<PaginationControls {...result.current.paginationProps} />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('Behavior 5: custom layout with both components', () => {
    const {result} = renderHook(
      () =>
        useSanityDocumentTable({
          documentType: 'article',
          columns: testColumns,
          pageSize: 25,
        }),
      {wrapper: NuqsWrapper},
    )

    renderWithTheme(
      <div>
        <h1>My Custom Header</h1>
        <DocumentTable {...result.current.tableProps} />
        <PaginationControls {...result.current.paginationProps} />
      </div>,
    )

    expect(screen.getByText('My Custom Header')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('Behavior 6: paginationProps forwards page size options', () => {
    const {result} = renderHook(
      () =>
        useSanityDocumentTable({
          documentType: 'article',
          columns: testColumns,
          pageSize: 25,
          pageSizeOptions: [10, 25, 50],
        }),
      {wrapper: NuqsWrapper},
    )

    expect(result.current.paginationProps.pageSizeOptions).toEqual([10, 25, 50])
  })

  it('Behavior 7: forwards server grouping props to DocumentTable', () => {
    const groupedColumns = [
      column.title(),
      column.custom({
        field: 'status',
        header: 'Status',
        groupable: true,
        groupField: 'coalesce(status, "draft")',
      }),
    ]

    const {result} = renderHook(
      () =>
        useSanityDocumentTable({
          documentType: 'article',
          columns: groupedColumns,
          pageSize: 25,
        }),
      {
        wrapper: ({children}: {children: React.ReactNode}) => (
          <NuqsTestingAdapter searchParams={{groupBy: 'status'}}>{children}</NuqsTestingAdapter>
        ),
      },
    )

    expect(result.current.tableProps.serverGroup).toEqual({
      groupBy: 'status',
      onGroupByChange: expect.any(Function),
      groupableColumnIds: ['status'],
    })
  })
})
