import '@testing-library/jest-dom/vitest'
import {screen, within, waitFor} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {SanityDocumentTable} from '../src/components/table/SanityDocumentTable'
import {column} from '../src/helpers/table/column'
import {renderWithTheme} from './helpers'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUsePaginatedDocuments = vi.fn()
const mockApply = vi.fn()
const mockUseDocuments = vi.fn()
const mockUseDocumentProjection = vi.fn()

type MockArticle = {
  _id: string
  _type: string
  _updatedAt: string
  author: null | {name: string}
  title: string
}

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: vi.fn(() => ({data: null, loading: false})),
  useApplyDocumentActions: () => mockApply,
  useDocuments: (...args: unknown[]) => mockUseDocuments(...args),
  useDocumentProjection: (...args: unknown[]) => mockUseDocumentProjection(...args),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: (doc: {documentId: string}, patches: Record<string, unknown>) => ({
    type: 'document.edit',
    documentId: doc.documentId,
    patches,
  }),
}))

// Mock @sanity/ui Popover to render content directly (no portal/animation in jsdom)
vi.mock('@sanity/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sanity/ui')>()
  type MockPopoverProps = React.ComponentProps<typeof actual.Popover>

  return {
    ...actual,
    Popover: React.forwardRef(function MockPopover(
      {children, content, open}: MockPopoverProps,
      _ref: React.ForwardedRef<HTMLDivElement>,
    ) {
      return (
        <>
          {open && content ? <div data-testid="mock-popover">{content}</div> : null}
          {children}
        </>
      )
    }),
  }
})

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

const mockArticlesWithAuthor: MockArticle[] = [
  {
    _id: 'article-1',
    _type: 'article',
    title: 'First Article',
    author: {name: 'Alice Author'},
    _updatedAt: '2026-01-01',
  },
]

const mockArticlesNoAuthor: MockArticle[] = [
  {
    _id: 'article-2',
    _type: 'article',
    title: 'Second Article',
    author: null,
    _updatedAt: '2026-01-02',
  },
]

const mockPersonHandles = [
  {documentId: 'person-1', documentType: 'person'},
  {documentId: 'person-2', documentType: 'person'},
]

const personTitles: Record<string, string> = {
  'person-1': 'Alice Author',
  'person-2': 'Bob Writer',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupMocks(articles: MockArticle[] = mockArticlesWithAuthor) {
  mockApply.mockResolvedValue(undefined)
  mockUsePaginatedDocuments.mockReturnValue({
    data: articles,
    isPending: false,
    hasNextPage: false,
    hasPreviousPage: false,
    fetchNextPage: vi.fn(),
    fetchPreviousPage: vi.fn(),
    totalCount: articles.length,
    currentPage: 1,
    totalPages: 1,
  })
  mockUseDocumentProjection.mockImplementation((handle: {documentId: string}) => {
    if (personTitles[handle.documentId]) {
      return {data: {name: personTitles[handle.documentId]}, isPending: false}
    }
    return {data: null, isPending: false}
  })
  mockUseDocuments.mockReturnValue({
    data: mockPersonHandles,
    isPending: false,
  })
}

function renderTableWithPlaceholder(_articles: MockArticle[] = mockArticlesWithAuthor) {
  return renderWithTheme(
    <SanityDocumentTable
      documentType="article"
      columns={[
        column.reference({
          field: 'author',
          header: 'Author',
          referenceType: 'person',
          edit: true,
          placeholder: 'Select Author',
          preview: {
            select: {name: 'name'},
            prepare: (value) => ({
              title: typeof value.name === 'string' ? value.name : undefined,
            }),
          },
        }),
      ]}
    />,
  )
}

function renderTableNoPlaceholder(_articles: MockArticle[] = mockArticlesWithAuthor) {
  return renderWithTheme(
    <SanityDocumentTable
      documentType="article"
      columns={[
        column.reference({
          field: 'author',
          header: 'Author',
          referenceType: 'person',
          edit: true,
          preview: {
            select: {name: 'name'},
            prepare: (value) => ({
              title: typeof value.name === 'string' ? value.name : undefined,
            }),
          },
        }),
      ]}
    />,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Reference field fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Fix 1: Empty state with configurable placeholder text + plus icon ──

  describe('Empty state — configurable placeholder', () => {
    it('Behavior 1: empty reference with placeholder shows Card/Button with placeholder text', () => {
      setupMocks(mockArticlesNoAuthor)
      renderTableWithPlaceholder(mockArticlesNoAuthor)

      const table = screen.getByRole('table')
      // Should show the placeholder text, not "Search…"
      expect(within(table).getByText('Select Author')).toBeInTheDocument()
    })

    it('Behavior 2: empty reference with placeholder shows a plus icon (AddIcon)', () => {
      setupMocks(mockArticlesNoAuthor)
      renderTableWithPlaceholder(mockArticlesNoAuthor)

      const table = screen.getByRole('table')
      // The plus icon should be rendered as a circle with "+" or AddIcon
      const addButton = within(table)
        .getByText('Select Author')
        .closest('[data-testid="reference-empty-state"]')
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('data-state', 'empty')
      expect(addButton).toHaveAttribute('data-border', 'false')
      // Should have an icon element (the plus/add icon)
      expect(addButton?.querySelector('svg')).toBeInTheDocument()
    })

    it('Behavior 3: empty reference without placeholder falls back to "Add…"', () => {
      setupMocks(mockArticlesNoAuthor)
      renderTableNoPlaceholder(mockArticlesNoAuthor)

      const table = screen.getByRole('table')
      expect(within(table).getByText('Add…')).toBeInTheDocument()
    })

    it('Behavior 4: clicking empty state opens the reference popover', async () => {
      const user = userEvent.setup()
      setupMocks(mockArticlesNoAuthor)
      renderTableWithPlaceholder(mockArticlesNoAuthor)

      const table = screen.getByRole('table')
      await user.click(within(table).getByText('Select Author'))

      // Popover should open with search input
      expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()
    })
  })

  // ── Fix 2: Click-to-edit on existing reference values ──

  describe('Click-to-edit on existing references', () => {
    it('Behavior 5: clicking a cell with an existing reference value opens the popover', async () => {
      const user = userEvent.setup()
      setupMocks(mockArticlesWithAuthor)
      renderTableNoPlaceholder(mockArticlesWithAuthor)

      const table = screen.getByRole('table')
      const filledCellShell = within(table)
        .getByText('Alice Author')
        .closest('[data-state="filled"]')
      expect(filledCellShell).toHaveAttribute('data-border', 'true')
      // Click on the existing reference display (Alice Author)
      await user.click(within(table).getByText('Alice Author'))

      // Popover should open
      expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()
    })

    it('Behavior 6: popover shows all options including the currently selected one', async () => {
      const user = userEvent.setup()
      setupMocks(mockArticlesWithAuthor)
      renderTableNoPlaceholder(mockArticlesWithAuthor)

      const table = screen.getByRole('table')
      await user.click(within(table).getByText('Alice Author'))

      const listbox = screen.getByRole('listbox')
      await waitFor(() => {
        expect(within(listbox).getByText('Alice Author')).toBeInTheDocument()
        expect(within(listbox).getByText('Bob Writer')).toBeInTheDocument()
      })
    })
  })

  // ── Fix 3: Optimistic update after reference selection ──

  describe('Optimistic update', () => {
    it('Behavior 7: after selecting a reference, cell immediately shows the new value', async () => {
      const user = userEvent.setup()
      setupMocks(mockArticlesWithAuthor)
      renderTableNoPlaceholder(mockArticlesWithAuthor)

      const table = screen.getByRole('table')
      // Open popover on existing reference
      await user.click(within(table).getByText('Alice Author'))

      const listbox = screen.getByRole('listbox')
      await waitFor(() => {
        expect(within(listbox).getByText('Bob Writer')).toBeInTheDocument()
      })

      // Select Bob Writer
      await user.click(within(listbox).getByText('Bob Writer'))

      // Cell should optimistically show "Bob Writer" immediately
      // (before the patch round-trips through the server)
      await waitFor(() => {
        expect(within(table).getByText('Bob Writer')).toBeInTheDocument()
      })
    })
  })
})
