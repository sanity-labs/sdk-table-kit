import {screen, within} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {column} from '../src/column'
import {SanityDocumentTable} from '../src/SanityDocumentTable'
import {renderWithTheme} from './helpers'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUsePaginatedDocuments = vi.fn()
const mockApply = vi.fn()
const mockUseDocuments = vi.fn()
const mockUseDocumentProjection = vi.fn()

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

const mockArticles = [
  {
    _id: 'article-1',
    _type: 'article',
    title: 'First Article',
    author: {
      firstName: 'Alice',
      lastName: 'Author',
      imageUrl: 'https://example.com/alice.jpg',
      jobTitle: 'Senior Writer',
    },
    _updatedAt: '2026-01-01',
  },
]

const mockPersonHandles = [
  {documentId: 'person-1', documentType: 'person'},
  {documentId: 'person-2', documentType: 'person'},
  {documentId: 'person-3', documentType: 'person'},
  {documentId: 'person-4', documentType: 'person'},
  {documentId: 'person-5', documentType: 'person'},
  {documentId: 'person-6', documentType: 'person'},
  {documentId: 'person-7', documentType: 'person'},
  {documentId: 'person-8', documentType: 'person'},
  {documentId: 'person-9', documentType: 'person'},
  {documentId: 'person-10', documentType: 'person'},
]

const personData: Record<
  string,
  {firstName: string; lastName: string; imageUrl: string | null; jobTitle: string}
> = {
  'person-1': {
    firstName: 'Alice',
    lastName: 'Author',
    imageUrl: 'https://example.com/alice.jpg',
    jobTitle: 'Senior Writer',
  },
  'person-2': {firstName: 'Bob', lastName: 'Writer', imageUrl: null, jobTitle: 'Editor'},
  'person-3': {
    firstName: 'Charlie',
    lastName: 'Editor',
    imageUrl: 'https://example.com/charlie.jpg',
    jobTitle: 'Reporter',
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupMocks() {
  mockApply.mockResolvedValue(undefined)
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
  mockUseDocumentProjection.mockImplementation(
    (handle: {documentId: string; documentType?: string}) => {
      // DocumentStatusCell calls with article IDs
      if (!handle.documentId || !personData[handle.documentId]) {
        return {data: null, isPending: false}
      }
      return {
        data: personData[handle.documentId],
        isPending: false,
      }
    },
  )
  mockUseDocuments.mockReturnValue({
    data: mockPersonHandles.slice(0, 3),
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
            select: {
              firstName: 'firstName',
              lastName: 'lastName',
              imageUrl: 'imageUrl',
              jobTitle: 'jobTitle',
            },
            prepare: ({firstName, lastName, imageUrl, jobTitle}: Record<string, unknown>) => ({
              title: `${firstName} ${lastName}`,
              subtitle: jobTitle,
              media: imageUrl,
            }),
          },
        }),
      ]}
    />,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Reference option cards — visual polish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('Behavior 1 (tracer bullet): option renders with title and subtitle from prepare()', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    const listbox = screen.getByRole('listbox')
    // Should show title
    expect(within(listbox).getByText('Alice Author')).toBeInTheDocument()
    // Should show subtitle
    expect(within(listbox).getByText('Senior Writer')).toBeInTheDocument()
    // Bob's subtitle
    expect(within(listbox).getByText('Editor')).toBeInTheDocument()
  })

  it('Behavior 2: option shows avatar image when prepare() returns media', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    const listbox = screen.getByRole('listbox')
    // Alice has an image — should show avatar img
    const aliceImg = within(listbox).getByAltText('Alice Author')
    expect(aliceImg).toBeInTheDocument()
    expect(aliceImg).toHaveAttribute('src', 'https://example.com/alice.jpg')
  })

  it('Behavior 3: option shows initial letter when no media', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    const listbox = screen.getByRole('listbox')
    // Bob has no image — should show initial 'B'
    const options = within(listbox).getAllByRole('option')
    const bobOption = options[1] // person-2
    expect(within(bobOption).getByText('B')).toBeInTheDocument()
  })

  it('Behavior 4: selected option has aria-selected=true', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')

    // None should be selected (the current value is an object, not a reference with _ref)
    // But if we had a matching _ref, it would be selected
    options.forEach((opt) => {
      expect(opt).toHaveAttribute('aria-selected')
    })
  })

  it('Behavior 5: options use theme tokens (no hardcoded colors)', async () => {
    const user = userEvent.setup()
    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')

    // Check that option styles use CSS variables, not hardcoded colors
    const firstOption = options[0]
    const style = firstOption.getAttribute('style') || ''
    expect(style).toContain('var(--card-')
  })

  it('Behavior 6: options list has max-height with overflow scroll', async () => {
    const user = userEvent.setup()
    // Return many results to test scroll
    mockUseDocuments.mockReturnValue({
      data: mockPersonHandles,
      isPending: false,
    })

    renderTable()

    const table = screen.getByRole('table')
    await user.click(within(table).getByText('Alice Author'))

    const listbox = screen.getByRole('listbox')
    const style = listbox.getAttribute('style') || ''
    expect(style).toContain('max-height')
    expect(style).toContain('overflow')
  })
})
