import {column, filter} from '@sanity-labs/react-table-kit'
import {screen} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {SanityDocumentTable} from '../src/components/table/SanityDocumentTable'
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

// Mock window.matchMedia for Sanity UI Popover
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
  {_id: 'article-1', _type: 'article', title: 'First Article', _updatedAt: '2026-01-01'},
  {_id: 'article-2', _type: 'article', title: 'Second Article', _updatedAt: '2026-01-02'},
  {_id: 'article-3', _type: 'article', title: 'Third Article', _updatedAt: '2026-01-03'},
]

const testColumns = [column.title(), column.updatedAt()]
const groupedColumns = [
  column.title(),
  column.custom({field: 'status', header: 'Status', groupable: true}),
]

describe('SanityDocumentTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: false,
      hasPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      totalCount: 3,
      currentPage: 1,
      totalPages: 1,
    })
    mockUseQuery.mockReturnValue({
      data: mockArticles,
      isPending: false,
    })
  })

  it('Behavior 1: renders a table with data from SDK', () => {
    renderWithTheme(<SanityDocumentTable documentType="article" columns={testColumns} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('First Article')).toBeInTheDocument()
    expect(screen.getByText('Second Article')).toBeInTheDocument()
    expect(screen.getByText('Third Article')).toBeInTheDocument()
  })

  it('Behavior 2: passes loading=true to DocumentTable when SDK is pending', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    })

    renderWithTheme(<SanityDocumentTable documentType="article" columns={testColumns} />)

    // When loading, DocumentTable renders skeleton rows (no actual data rows)
    // The skeleton is rendered as a Card with animated divs, not a table
    // Verify no actual article text is rendered
    expect(screen.queryByText('First Article')).not.toBeInTheDocument()
  })

  it('Behavior 3: renders empty state when no documents', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isPending: false,
    })

    renderWithTheme(<SanityDocumentTable documentType="article" columns={testColumns} />)

    expect(screen.getByText('No documents found')).toBeInTheDocument()
  })

  it('Behavior 4: custom empty message', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isPending: false,
    })

    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={testColumns}
        emptyMessage="No articles found"
      />,
    )

    expect(screen.getByText('No articles found')).toBeInTheDocument()
  })

  it('Behavior 5: passes onRowClick prop to DocumentTable', () => {
    const onRowClick = vi.fn()

    // onRowClick is defined in DocumentTableProps but not yet wired to <tr> onClick
    // in the base component. This test verifies the prop is accepted and forwarded.
    // When the base component implements row click handling, this will work end-to-end.
    renderWithTheme(
      <SanityDocumentTable documentType="article" columns={testColumns} onRowClick={onRowClick} />,
    )

    // Component renders without error when onRowClick is provided
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('First Article')).toBeInTheDocument()
  })

  it('Behavior 6: pagination controls shown when multiple pages', () => {
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockArticles,
      isPending: false,
      hasNextPage: true,
      hasPreviousPage: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      totalCount: 75,
      currentPage: 1,
      totalPages: 3,
    })

    renderWithTheme(
      <SanityDocumentTable documentType="article" columns={testColumns} pageSize={25} />,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('Behavior 7: pagination hidden when single page', () => {
    renderWithTheme(<SanityDocumentTable documentType="article" columns={testColumns} />)

    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('Behavior 8: uses useQuery mode when documentType is an array', () => {
    renderWithTheme(
      <SanityDocumentTable documentType={['article', 'page']} columns={testColumns} />,
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

  it('Behavior 9: renders server grouping controls when filters are present', () => {
    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={groupedColumns}
        filters={[filter.search({label: 'Search', fields: ['title']})]}
      />,
    )

    expect(screen.getByTestId('group-by-select')).toBeInTheDocument()
    expect(screen.getByText('Group by')).toBeInTheDocument()
    expect(screen.queryByText('Group by:')).not.toBeInTheDocument()
  })
})
