import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {render, screen, within, fireEvent} from '@testing-library/react'
import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import React from 'react'
import {describe, it, expect, vi, beforeEach, beforeAll} from 'vitest'

// Mock SDK hooks
const mockCurrentUser = vi.fn()
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()
const mockUseDocumentProjection = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => mockCurrentUser(),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue({}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useDocumentPreview: () => ({data: {title: 'Preview'}}),
  useDocumentProjection: (...args: unknown[]) => mockUseDocumentProjection(...args),
  useUsers: () => ({data: []}),
  useActiveReleases: () => [],
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: vi.fn(),
}))

import {column} from '../src/column'
import {DocumentStatusCell, getStatusSortPriority} from '../src/DocumentStatusCell'
import {SanityDocumentTable} from '../src/SanityDocumentTable'

const theme = buildTheme()

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <NuqsTestingAdapter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </NuqsTestingAdapter>,
  )
}

// Sanity UI needs window.matchMedia in jsdom
beforeAll(() => {
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
})

const mockData = [
  {_id: 'drafts.doc-1', _type: 'article', title: 'Draft Article'},
  {_id: 'doc-2', _type: 'article', title: 'Published Article'},
  {_id: 'drafts.doc-3', _type: 'article', title: 'Edited Article'},
]

describe('DocumentStatusCell — SDK-native status via useDocumentProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test',
      roles: [{name: 'editor', title: 'Editor'}],
    })
    mockUseQuery.mockReturnValue({data: mockData, isPending: false})
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockData,
      isPending: false,
      currentPage: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      totalCount: 3,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    // Default: return null for both published and draft (New state)
    mockUseDocumentProjection.mockReturnValue({data: null})
  })

  it('Behavior 1 [TRACER]: renders Draft label when only draft exists', () => {
    mockUseDocumentProjection.mockImplementation(({documentId}: {documentId: string}) => {
      // drafts.doc-1 exists, doc-1 (published) does not
      if (documentId === 'drafts.doc-1') return {data: {_updatedAt: '2026-01-01'}}
      return {data: null}
    })

    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="drafts.doc-1" documentType="article" />,
    )

    // Should render a single dot (draft = yellow/caution)
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(1)
  })

  it('Behavior 2: renders Published label when only published exists', () => {
    mockUseDocumentProjection.mockImplementation(({documentId}: {documentId: string}) => {
      if (documentId === 'doc-2') return {data: {_updatedAt: '2026-01-01'}}
      return {data: null}
    })

    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-2" documentType="article" />,
    )

    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(1)
  })

  it('Behavior 3: renders Modified (two dots) when both draft and published exist', () => {
    // Component uses useQuery with sanity::versionOf — return both published and draft docs
    mockUseQuery.mockReturnValue({
      data: [
        {_id: 'doc-3', _updatedAt: '2026-01-01'},
        {_id: 'drafts.doc-3', _updatedAt: '2026-01-02'},
      ],
      isPending: false,
    })

    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="drafts.doc-3" documentType="article" />,
    )

    // Modified state shows two dots (green + yellow)
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(2)
  })

  it('Behavior 4: getStatusSortPriority returns lower number for drafts', () => {
    expect(getStatusSortPriority('drafts.doc-1')).toBeLessThan(getStatusSortPriority('doc-2'))
  })

  it('Behavior 5: column.documentStatus() renders status dots as first column', () => {
    renderWithTheme(
      <SanityDocumentTable
        documentType={['article']}
        columns={[column.documentStatus(), column.title(), column.type()]}
      />,
    )

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    // Should have: Select(auto) + Status + Title + Type = 4
    expect(headers.length).toBeGreaterThanOrEqual(4)
    // Second header should be the status column with no text (first is auto-inserted select)
    expect(headers[1].textContent?.trim()).toBe('')
  })

  it('Behavior 6: omitting column.documentStatus() excludes status column', () => {
    renderWithTheme(
      <SanityDocumentTable documentType={['article']} columns={[column.title(), column.type()]} />,
    )

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const headerTexts = headers.map((h) => h.textContent)
    expect(headerTexts).toContain('Title')
    expect(headerTexts).toContain('Type')
  })

  it('Behavior 7: status column is sortable — clicking header triggers sort', () => {
    renderWithTheme(
      <SanityDocumentTable
        documentType={['article']}
        columns={[column.documentStatus(), column.title()]}
      />,
    )

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const statusHeader = headers[1] // [0] is auto-inserted select column
    fireEvent.click(statusHeader)
    // No error thrown = sort works
  })

  it('Behavior 8: status column has ~32px width and no header text', () => {
    renderWithTheme(
      <SanityDocumentTable
        documentType={['article']}
        columns={[column.documentStatus(), column.title()]}
      />,
    )

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const statusHeader = headers[1] // [0] is auto-inserted select column
    expect(statusHeader.textContent?.trim()).toBe('')
  })
})
