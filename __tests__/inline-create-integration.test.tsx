import {describe, it, expect, vi, beforeEach} from 'vitest'
import {screen, fireEvent, waitFor, act} from '@testing-library/react'
import React from 'react'
import {column} from '@sanetti/sanity-table-kit'
import {SanityDocumentTable} from '../src/SanityDocumentTable'
import {renderWithTheme} from './helpers'

// Mock @sanity/sdk-react
const mockApply = vi.fn().mockResolvedValue(undefined)
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useDocumentProjection: () => ({data: null}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useApplyDocumentActions: () => mockApply,
  useClient: () => ({config: () => ({projectId: 'test', dataset: 'production'})}),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn((handle: unknown, initialValue?: unknown) => ({
    type: 'createDocument',
    handle,
    initialValue,
  })),
}))

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
  {
    _id: 'article-1',
    _type: 'article',
    title: 'First Article',
    status: 'draft',
    _updatedAt: '2026-01-01',
  },
  {
    _id: 'article-2',
    _type: 'article',
    title: 'Second Article',
    status: 'published',
    _updatedAt: '2026-01-02',
  },
  {
    _id: 'article-3',
    _type: 'article',
    title: 'Third Article',
    status: 'draft',
    _updatedAt: '2026-01-03',
  },
]

const testColumns = [
  column.title({field: 'title', searchable: true}),
  column.badge({
    field: 'status',
    colorMap: {draft: 'caution', published: 'positive'},
    filterable: true,
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUsePaginatedDocuments.mockReturnValue({
    data: mockArticles,
    isPending: false,
    hasMore: false,
    loadMore: vi.fn(),
  })
  mockUseQuery.mockReturnValue({data: null, loading: false})
})

describe('Inline Create Integration (IC-T6)', () => {
  it('Behavior 1 (tracer): SanityDocumentTable with createDocument shows Add button', () => {
    renderWithTheme(
      <SanityDocumentTable documentType="article" columns={testColumns} createDocument={true} />,
    )
    expect(screen.getByText('Add article')).toBeDefined()
  })

  it('Behavior 2: clicking Add button calls createDocument via SDK', async () => {
    renderWithTheme(
      <SanityDocumentTable documentType="article" columns={testColumns} createDocument={true} />,
    )
    fireEvent.click(screen.getByText('Add article'))
    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledTimes(1)
    })
  })

  it('Behavior 3: button shows spinner state during creation', async () => {
    let resolveApply: () => void
    mockApply.mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolveApply = r
        }),
    )

    renderWithTheme(
      <SanityDocumentTable documentType="article" columns={testColumns} createDocument={true} />,
    )

    fireEvent.click(screen.getByText('Add article'))

    await waitFor(() => {
      expect(screen.getByText('Adding…')).toBeDefined()
      const button = screen.getByText('Adding…').closest('button')
      expect(button?.disabled).toBe(true)
    })

    // Resolve creation
    await resolveApply!()
  })

  it('Behavior 4: createDocument with config passes initialValues', async () => {
    const {createDocument} = await import('@sanity/sdk')

    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={testColumns}
        createDocument={{initialValues: {status: 'in_review', priority: 'high'}}}
      />,
    )

    fireEvent.click(screen.getByText('Add article'))

    await waitFor(() => {
      expect(createDocument).toHaveBeenCalledWith(
        {documentType: 'article'},
        expect.objectContaining({status: 'in_review', priority: 'high'}),
      )
    })
  })

  it('Behavior 5: createDocument with custom buttonText', () => {
    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={testColumns}
        createDocument={{buttonText: 'New Story'}}
      />,
    )
    expect(screen.getByText('New Story')).toBeDefined()
  })

  it('Behavior 6: button row spans full grid width', () => {
    const manyColumns = [
      column.title({field: 'title'}),
      column.badge({field: 'status', colorMap: {draft: 'caution'}}),
      column.date({field: '_updatedAt'}),
    ]

    renderWithTheme(
      <SanityDocumentTable documentType="article" columns={manyColumns} createDocument={true} />,
    )

    const addRow = screen.getByTestId('add-document-row')
    const cell = addRow.querySelector('[role="cell"]')
    expect(cell?.style.gridColumn).toBe('1 / -1')
  })

  it('Behavior 7: spinner stays visible until new data arrives', async () => {
    // Start with a pending apply so we can control timing
    let resolveApply: () => void
    mockApply.mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolveApply = r
        }),
    )

    const {rerender} = renderWithTheme(
      <SanityDocumentTable documentType="article" columns={testColumns} createDocument={true} />,
    )

    // Click Add
    fireEvent.click(screen.getByText('Add article'))

    // Verify spinner is showing
    await waitFor(() => {
      expect(screen.getByText('Adding…')).toBeDefined()
    })

    // Resolve the API call — spinner should STILL be visible (deferred reset)
    await act(async () => {
      resolveApply!()
    })

    // Spinner should still be visible because data hasn't changed yet
    expect(screen.getByText('Adding…')).toBeDefined()

    // Now simulate new data arriving from the live query subscription
    const updatedArticles = [
      ...mockArticles,
      {
        _id: 'article-4',
        _type: 'article',
        title: 'New Article',
        status: 'draft',
        _updatedAt: '2026-01-04',
      },
    ]
    mockUsePaginatedDocuments.mockReturnValue({
      data: updatedArticles,
      isPending: false,
      hasMore: false,
      loadMore: vi.fn(),
    })

    // Re-render with new data
    rerender(
      <SanityDocumentTable documentType="article" columns={testColumns} createDocument={true} />,
    )

    // Now the button should reset to "Add article"
    await waitFor(() => {
      expect(screen.getByText('Add article')).toBeDefined()
    })
  })
})
