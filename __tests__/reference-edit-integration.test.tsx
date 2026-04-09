import {screen, within} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {SanityDocumentTable} from '../src/components/table/SanityDocumentTable'
import {column} from '../src/helpers/table/column'
import {renderWithTheme} from './helpers'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()
const mockApply = vi.fn()
const mockUseDocuments = vi.fn()
const mockUseDocumentProjection = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useApplyDocumentActions: () => mockApply,
  useDocuments: (...args: unknown[]) => mockUseDocuments(...args),
  useDocumentProjection: (...args: unknown[]) => mockUseDocumentProjection(...args),
  useActiveReleases: () => [],
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: (doc: {documentId: string}, patches: Record<string, unknown>) => ({
    type: 'document.edit',
    documentId: doc.documentId,
    patches,
  }),
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

// ── Mock data ────────────────────────────────────────────────────────────────

// With the new API, the resolved author field is an object shaped by preview.select
const mockArticles = [
  {
    _id: 'article-1',
    _type: 'article',
    title: 'First Article',
    author: {name: 'Alice Author'},
    _updatedAt: '2026-01-01',
  },
  {
    _id: 'article-2',
    _type: 'article',
    title: 'Second Article',
    author: {name: 'Bob Author'},
    _updatedAt: '2026-01-02',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupMocks() {
  mockApply.mockResolvedValue(undefined)
  mockUseQuery.mockReturnValue({data: mockArticles, isPending: false})
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
  // DocumentStatusCell uses useDocumentProjection
  mockUseDocumentProjection.mockReturnValue({data: null, isPending: false})
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Reference edit integration — column.reference({edit: true})', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('Behavior 1 [TRACER]: column.reference with edit:true renders ReferenceCell with prepared title', async () => {
    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={[
          column.reference({
            field: 'author',
            header: 'Author',
            referenceType: 'author',
            edit: true,
            preview: {
              select: {name: 'name'},
              prepare: ({name}) => ({title: name}),
            },
          }),
        ]}
      />,
    )

    const table = screen.getByRole('table')
    // ReferenceCell renders the prepared title
    expect(within(table).getByText('Alice Author')).toBeInTheDocument()
    expect(within(table).getByText('Bob Author')).toBeInTheDocument()
  })

  it('Behavior 2: column.reference without edit renders normal display (no edit affordance)', async () => {
    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={[
          column.reference({
            field: 'author',
            header: 'Author',
            referenceType: 'author',
            preview: {
              select: {name: 'name'},
              prepare: ({name}) => ({title: name}),
            },
          }),
        ]}
      />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getByText('Alice Author')).toBeInTheDocument()
    // No edit button/affordance present
    expect(within(table).queryByRole('button', {name: /edit/i})).not.toBeInTheDocument()
  })

  // TODO (Task 2): Behavior 3 — selecting a reference patches with correct {_type: "reference", _ref: id} format
  // TODO (Task 2): Behavior 4 — referenceType prop is passed to ReferenceEditPopover for document search
  // TODO (Task 2): Behavior 5 — clearing a reference patches the field with null
})
