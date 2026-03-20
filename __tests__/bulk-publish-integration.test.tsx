import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {render, screen, within, fireEvent, act} from '@testing-library/react'
import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import React from 'react'
import {describe, it, expect, vi, beforeAll} from 'vitest'

const mockApply = vi.fn().mockResolvedValue({})

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'u1', name: 'T', roles: [{name: 'editor', title: 'E'}]}),
  useDocumentProjection: () => ({data: null}),
  useApplyDocumentActions: () => mockApply,
  usePaginatedDocuments: () => ({
    data: [],
    isPending: false,
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    totalCount: 0,
    fetchNextPage: vi.fn(),
    fetchPreviousPage: vi.fn(),
  }),
  useQuery: () => ({
    data: [
      {_id: 'drafts.doc-1', _type: 'article', title: 'Article One'},
      {_id: 'drafts.doc-2', _type: 'article', title: 'Article Two'},
      {_id: 'drafts.doc-3', _type: 'article', title: 'Article Three'},
    ],
    isPending: false,
  }),
  useDocumentPreview: () => ({data: {title: 'P'}}),
  useUsers: () => ({data: []}),
  useDocumentPermissions: () => ({allowed: true, message: null}),
  useActiveReleases: () => [],
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: vi.fn(),
  publishDocument: vi.fn((d: {documentId: string}) => ({
    type: 'publish',
    documentId: d.documentId,
  })),
}))

import {column} from '../src/column'
import {SanityDocumentTable} from '../src/SanityDocumentTable'
import type {SanityDocumentTableProps} from '../src/SanityDocumentTable'

const theme = buildTheme()

function renderTable(extraProps?: Partial<SanityDocumentTableProps>) {
  return render(
    <NuqsTestingAdapter>
      <ThemeProvider theme={theme}>
        <SanityDocumentTable
          documentType={['article']}
          columns={[column.title()]}
          {...extraProps}
        />
      </ThemeProvider>
    </NuqsTestingAdapter>,
  )
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('Bulk publish integration', () => {
  it('Behavior 1 [TRACER]: Publish button appears when rows selected', () => {
    renderTable()
    const table = screen.getByRole('table')
    const checkboxes = within(table).getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(1)
    fireEvent.click(checkboxes[1])
    expect(screen.getByText(/publish/i)).toBeDefined()
  })

  it('Behavior 2: Publish button shows count', () => {
    renderTable()
    const table = screen.getByRole('table')
    const checkboxes = within(table).getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])
    expect(screen.getByText(/publish 2/i)).toBeDefined()
  })

  it('Behavior 3: clicking Publish opens confirm dialog', () => {
    renderTable()
    const table = screen.getByRole('table')
    const checkboxes = within(table).getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText(/publish/i))
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('Behavior 4: confirm dialog shows document titles', () => {
    renderTable()
    const table = screen.getByRole('table')
    const checkboxes = within(table).getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText(/publish/i))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Article One')).toBeDefined()
  })

  it('Behavior 5: successful publish calls apply', async () => {
    renderTable()
    const table = screen.getByRole('table')
    const checkboxes = within(table).getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText(/publish/i))
    const dialog = screen.getByRole('dialog')
    const confirmBtn = within(dialog).getByTestId('publish-button')
    await act(async () => {
      fireEvent.click(confirmBtn)
    })
    expect(mockApply).toHaveBeenCalled()
  })

  it('Behavior 6: handles publish error', async () => {
    mockApply.mockRejectedValueOnce(new Error('fail'))
    renderTable()
    const table = screen.getByRole('table')
    const checkboxes = within(table).getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText(/publish/i))
    const dialog = screen.getByRole('dialog')
    const confirmBtn = within(dialog).getByTestId('publish-button')
    await act(async () => {
      fireEvent.click(confirmBtn)
    })
    expect(mockApply).toHaveBeenCalled()
  })

  it('Behavior 7: consumer bulkActions appended after publish', () => {
    renderTable({bulkActions: () => <button>Archive</button>})
    const table = screen.getByRole('table')
    const checkboxes = within(table).getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(screen.getByText(/publish/i)).toBeDefined()
    expect(screen.getByText('Archive')).toBeDefined()
  })
})
