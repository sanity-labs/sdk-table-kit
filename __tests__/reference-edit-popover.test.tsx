import {screen, within, waitFor} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
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

const mockArticles = [
  {
    _id: 'article-1',
    _type: 'article',
    title: 'First Article',
    author: {_id: 'person-1', name: 'Alice Author'},
    _updatedAt: '2026-01-01',
  },
]

const mockPersonHandles = [
  {documentId: 'person-1', documentType: 'person'},
  {documentId: 'person-2', documentType: 'person'},
  {documentId: 'person-3', documentType: 'person'},
]

const personTitles: Record<string, string> = {
  'person-1': 'Alice Author',
  'person-2': 'Bob Writer',
  'person-3': 'Charlie Editor',
}

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
    totalCount: 1,
    currentPage: 1,
    totalPages: 1,
  })
  // DocumentStatusCell uses useDocumentProjection
  mockUseDocumentProjection.mockReturnValue({data: null, isPending: false})
  // Reference search results
  mockUseDocuments.mockReturnValue({
    data: mockPersonHandles,
    isPending: false,
  })
}

function renderTable() {
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
            prepare: ({name}) => ({title: name}),
          },
        }),
      ]}
    />,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReferenceEditPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('Behavior 1 (tracer bullet): clicking a reference cell opens a Popover with a TextInput search field', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    const authorCell = within(table).getByText('Alice Author')

    await user.click(authorCell)

    // Should show a search input in the popover
    expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()
  })

  it('Behavior 2: popover shows all documents of referenceType on open', async () => {
    const user = userEvent.setup()
    // Mock useDocumentProjection to return titles for each person handle
    mockUseDocumentProjection.mockImplementation((handle: {documentId: string}) => ({
      data: {name: personTitles[handle.documentId] || 'Unknown'},
      isPending: false,
    }))

    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    // All 3 person documents should be shown as options in the listbox
    const listbox = screen.getByRole('listbox')
    await waitFor(() => {
      expect(within(listbox).getByText('Alice Author')).toBeInTheDocument()
      expect(within(listbox).getByText('Bob Writer')).toBeInTheDocument()
      expect(within(listbox).getByText('Charlie Editor')).toBeInTheDocument()
    })
  })

  it('Behavior 3: each option shows title from prepare()', async () => {
    const user = userEvent.setup()
    mockUseDocumentProjection.mockImplementation((handle: {documentId: string}) => ({
      data: {name: personTitles[handle.documentId] || 'Unknown'},
      isPending: false,
    }))

    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    // Options should show prepared titles
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(3)
  })

  it('Behavior 4: typing in search field filters results (debounced)', async () => {
    const user = userEvent.setup()

    mockUseDocumentProjection.mockReturnValue({data: null, isPending: false})

    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    const searchInput = screen.getByPlaceholderText('Type to search...')
    await user.type(searchInput, 'Bob')

    // Wait for debounce (300ms) + re-render
    await waitFor(
      () => {
        // useDocuments should have been called with search param
        const calls = mockUseDocuments.mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]).toEqual(expect.objectContaining({search: 'Bob'}))
      },
      {timeout: 1000},
    )
  })

  it('Behavior 5: clicking an option calls onSave and closes popover', async () => {
    const user = userEvent.setup()
    mockUseDocumentProjection.mockImplementation((handle: {documentId: string}) => ({
      data: {name: personTitles[handle.documentId] || 'Unknown'},
      isPending: false,
    }))

    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    // Wait for options to render
    const listbox = screen.getByRole('listbox')
    await waitFor(() => {
      expect(within(listbox).getByText('Bob Writer')).toBeInTheDocument()
    })

    // Click Bob Writer option
    await user.click(within(listbox).getByText('Bob Writer'))

    // Should have called apply with the editDocument action
    expect(mockApply).toHaveBeenCalled()

    // Popover should be closed
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Type to search...')).not.toBeInTheDocument()
    })
  })

  it('Behavior 6: popover shows Spinner while results are loading', async () => {
    const user = userEvent.setup()
    mockUseDocuments.mockReturnValue({data: [], isPending: true})

    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    // Should show loading indicator (Spinner component, not text)
    const popover = screen.getByTestId('mock-popover')
    expect(popover.querySelector('[data-ui="Spinner"]')).toBeInTheDocument()
  })

  it('Behavior 7: popover shows "No results" when search returns empty', async () => {
    const user = userEvent.setup()
    mockUseDocuments.mockReturnValue({data: [], isPending: false})

    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('Behavior 8: pressing Escape closes the popover', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    // Popover should be open
    expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()

    // Press Escape
    await user.keyboard('{Escape}')

    // Popover should be closed
    expect(screen.queryByPlaceholderText('Type to search...')).not.toBeInTheDocument()
  })

  it('Behavior 9: clicking outside the popover closes it', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    // Popover should be open
    expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument()

    // Click outside (on the table header)
    await user.click(screen.getByRole('columnheader', {name: /author/i}))

    // Popover should be closed
    expect(screen.queryByPlaceholderText('Type to search...')).not.toBeInTheDocument()
  })

  it('Behavior 10: clear button removes reference and closes popover', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    // Click clear button
    const clearBtn = screen.getByRole('button', {name: /clear/i})
    await user.click(clearBtn)

    // Should have called apply
    expect(mockApply).toHaveBeenCalled()

    // Popover should be closed
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Type to search...')).not.toBeInTheDocument()
    })
  })
})
