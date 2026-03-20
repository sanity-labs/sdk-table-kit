import type {ColumnDef} from '@sanetti/sanity-table-kit'
import {screen, within} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach, beforeAll} from 'vitest'

import {column} from '../src/column'
import {renderWithTheme} from './helpers'

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

// Mock SDK hooks
const mockCurrentUser = vi.fn()
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => mockCurrentUser(),
  useDocumentProjection: () => ({data: null}),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue({}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useDocumentPreview: () => ({data: {title: 'Preview'}}),
  useUsers: () => ({data: []}),
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: vi.fn(),
}))

import {SanityDocumentTable} from '../src/SanityDocumentTable'

const mockData = [
  {_id: 'doc-1', _type: 'article', title: 'Alpha', status: 'draft'},
  {_id: 'doc-2', _type: 'article', title: 'Beta', status: 'published'},
]

describe('Role visibility — SanityDocumentTable integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuery.mockReturnValue({data: mockData, isPending: false})
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockData,
      isPending: false,
      currentPage: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      totalCount: 2,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
  })

  it('Behavior 1 [TRACER]: SDK column helpers accept visibleTo and editableBy', () => {
    const cols = [
      column.title({visibleTo: ['editor']}),
      column.badge({
        field: 'status',
        colorMap: {draft: 'caution'},
        edit: true,
        editableBy: ['administrator'],
      }),
    ]
    expect(cols).toHaveLength(2)
    expect((cols[0] as ColumnDef & {visibleTo?: string[]}).visibleTo).toEqual(['editor'])
    expect((cols[1] as ColumnDef & {editableBy?: string[]}).editableBy).toEqual(['administrator'])
  })

  it('Behavior 2: SanityDocumentTable hides column when visibleTo does not match', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test',
      roles: [{name: 'editor', title: 'Editor'}],
    })

    renderWithTheme(
      <SanityDocumentTable
        documentType={['article']}
        columns={[
          column.title(),
          column.badge({
            field: 'status',
            colorMap: {draft: 'caution'},
            visibleTo: ['administrator'],
          }),
        ]}
      />,
    )

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const headerTexts = headers.map((h) => h.textContent)
    expect(headerTexts).toContain('Title')
    expect(headerTexts).not.toContain('Status')
  })

  it('Behavior 3: column with editableBy not matching renders without edit', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test',
      roles: [{name: 'viewer', title: 'Viewer'}],
    })

    renderWithTheme(
      <SanityDocumentTable
        documentType={['article']}
        columns={[column.title({edit: true, editableBy: ['editor']})]}
      />,
    )

    const table = screen.getByRole('table')
    const cell = within(table).getByText('Alpha')
    // Non-editable cell should not have cursor:pointer
    const cellDiv = cell.closest('[role="cell"]')
    const style = cellDiv?.getAttribute('style') || ''
    expect(style).not.toContain('pointer')
  })

  it('Behavior 4: all columns render when no role props (backward compat)', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test',
      roles: [{name: 'editor', title: 'Editor'}],
    })

    renderWithTheme(
      <SanityDocumentTable documentType={['article']} columns={[column.title(), column.type()]} />,
    )

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    // 3 columns: Select(auto) + Title + Type
    expect(headers).toHaveLength(3)
  })

  it('Behavior 5: visibleTo matching shows column, editableBy not matching strips edit', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test',
      roles: [{name: 'editor', title: 'Editor'}],
    })

    renderWithTheme(
      <SanityDocumentTable
        documentType={['article']}
        columns={[
          column.badge({
            field: 'status',
            colorMap: {draft: 'caution'},
            edit: true,
            visibleTo: ['editor'],
            editableBy: ['administrator'],
          }),
        ]}
      />,
    )

    const table = screen.getByRole('table')
    // Column should be visible
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toContain('Status')
    // But cells should not be editable (no cursor:pointer)
    const cells = within(table).getAllByRole('cell')
    const statusCell = cells.find((c) => c.textContent?.includes('draft'))
    const style = statusCell?.getAttribute('style') || ''
    expect(style).not.toContain('pointer')
  })
})
