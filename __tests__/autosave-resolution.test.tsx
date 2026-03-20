import {screen, within} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {column} from '../src/column'
import {SanityDocumentTable} from '../src/SanityDocumentTable'
import {renderWithTheme} from './helpers'

// Mock @sanity/sdk-react
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()
const mockApply = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useDocumentProjection: () => ({data: null}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useApplyDocumentActions: () => mockApply,
  useActiveReleases: () => [],
}))

// Mock @sanity/sdk editDocument to return a recognizable action
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

const mockArticles = [
  {_id: 'article-1', _type: 'article', title: 'First Article', _updatedAt: '2026-01-01'},
  {_id: 'article-2', _type: 'article', title: 'Second Article', _updatedAt: '2026-01-02'},
]

/**
 * _autoSave resolution in SanityDocumentTable.
 *
 * When columns have `edit: { _autoSave: true, _field: 'title' }`,
 * SanityDocumentTable resolves them at render time by wiring up
 * useSDKEditHandler().createOnSave(field) as the onSave callback.
 */
describe('SanityDocumentTable — _autoSave resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApply.mockResolvedValue(undefined)
    mockUseQuery.mockReturnValue({data: [], isPending: false})
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
  })

  it('Behavior 1: edit: true column becomes editable — clicking cell opens text input', async () => {
    const user = userEvent.setup()

    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={[column.title({edit: true}), column.updatedAt()]}
      />,
    )

    const table = screen.getByRole('table')
    // Title cell should be editable — click it to activate edit mode
    const titleCell = within(table).getByText('First Article')
    await user.click(titleCell)

    // After clicking, a text input should appear (text edit mode)
    // Use getAllByRole since FilterBar search may also be a textbox
    const inputs = within(table).getAllByRole('textbox')
    const editInput = inputs.find((input) => (input as HTMLInputElement).value === 'First Article')
    expect(editInput).toBeDefined()
    expect(editInput).toHaveValue('First Article')
  })

  it('Behavior 2: editing and saving calls useEditDocument with correct field and value', async () => {
    const user = userEvent.setup()

    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={[column.title({edit: true}), column.updatedAt()]}
      />,
    )

    const table = screen.getByRole('table')
    const titleCell = within(table).getByText('First Article')
    await user.click(titleCell)

    const inputs = within(table).getAllByRole('textbox')
    const input = inputs.find((el) => (el as HTMLInputElement).value === 'First Article')!
    await user.clear(input)
    await user.type(input, 'Updated Title')
    // Blur to save
    await user.tab()

    expect(mockApply).toHaveBeenCalledWith({
      type: 'document.edit',
      documentId: 'article-1',
      patches: {set: {title: 'Updated Title'}},
    })
  })

  it('Behavior 3: explicit onSave is NOT overridden by auto-save', async () => {
    const user = userEvent.setup()
    const customSave = vi.fn()

    renderWithTheme(
      <SanityDocumentTable
        documentType="article"
        columns={[column.title({edit: {onSave: customSave}}), column.updatedAt()]}
      />,
    )

    const table = screen.getByRole('table')
    const titleCell = within(table).getByText('First Article')
    await user.click(titleCell)

    const inputs = within(table).getAllByRole('textbox')
    const input = inputs.find((el) => (el as HTMLInputElement).value === 'First Article')!
    await user.clear(input)
    await user.type(input, 'Custom Save')
    await user.tab()

    // Custom handler called, NOT the SDK apply
    expect(customSave).toHaveBeenCalled()
    expect(mockApply).not.toHaveBeenCalled()
  })

  it('Behavior 4: columns without edit are unaffected', () => {
    renderWithTheme(
      <SanityDocumentTable documentType="article" columns={[column.title(), column.updatedAt()]} />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getByText('First Article')).toBeInTheDocument()
    // No edit UI should be present
    expect(within(table).queryByRole('textbox')).not.toBeInTheDocument()
  })
})
