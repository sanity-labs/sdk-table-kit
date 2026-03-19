import {describe, it, expect, vi, beforeEach} from 'vitest'
import {renderHook} from '@testing-library/react'
import {render, screen} from '@testing-library/react'
import React from 'react'
import {column, DocumentTable} from '@sanetti/sanity-table-kit'
import {useSanityDocumentTable} from '../src/useSanityDocumentTable'
import {PaginationControls} from '../src/PaginationControls'
import {renderWithTheme} from './helpers'

// Mock @sanity/sdk-react
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useDocumentProjection: () => ({data: null}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useActiveReleases: () => [],
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

const testColumns = [column.title(), column.updatedAt()]

describe('useSanityDocumentTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: true,
      hasPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      totalCount: 50,
      currentPage: 1,
      totalPages: 2,
    })
  })

  it('Behavior 1: returns tableProps with data, columns, loading', () => {
    const {result} = renderHook(() =>
      useSanityDocumentTable({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(result.current.tableProps).toBeDefined()
    expect(result.current.tableProps.data).toEqual(mockArticles)
    expect(result.current.tableProps.columns).toEqual(testColumns)
    expect(result.current.tableProps.loading).toBe(false)
  })

  it('Behavior 2: returns paginationProps with pagination and loading', () => {
    const {result} = renderHook(() =>
      useSanityDocumentTable({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    expect(result.current.paginationProps).toBeDefined()
    expect(result.current.paginationProps.pagination.currentPage).toBe(1)
    expect(result.current.paginationProps.pagination.totalPages).toBe(2)
    expect(result.current.paginationProps.loading).toBe(false)
  })

  it('Behavior 3: tableProps spreadable onto DocumentTable', () => {
    const {result} = renderHook(() =>
      useSanityDocumentTable({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    renderWithTheme(<DocumentTable {...result.current.tableProps} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('Behavior 4: paginationProps spreadable onto PaginationControls', () => {
    const {result} = renderHook(() =>
      useSanityDocumentTable({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
    )

    render(<PaginationControls {...result.current.paginationProps} />)

    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
  })

  it('Behavior 5: custom layout with both components', () => {
    const {result} = renderHook(() =>
      useSanityDocumentTable({
        documentType: 'article',
        columns: testColumns,
        pageSize: 25,
      }),
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
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
  })
})
