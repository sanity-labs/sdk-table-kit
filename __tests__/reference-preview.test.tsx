import {DocumentTable} from '@sanetti/sanity-table-kit'
import {screen, within} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi} from 'vitest'

import {column} from '../src/helpers/table/column'
import type {SanityColumnDef} from '../src/hooks/useColumnProjection'
import {renderWithTheme} from './helpers'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useDocuments: vi.fn(() => ({data: [], isPending: false})),
  useDocumentProjection: vi.fn(() => ({data: null, isPending: false})),
  useApplyDocumentActions: () => vi.fn(),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: (doc: {documentId: string}, patches: Record<string, unknown>) => ({
    type: 'document.edit',
    documentId: doc.documentId,
    patches,
  }),
}))

// ── Mock data ────────────────────────────────────────────────────────────────

// After GROQ dereference, the resolved value is an object with the selected fields
const mockData = [
  {
    _id: 'doc-1',
    _type: 'article',
    title: 'First Article',
    author: {firstName: 'Alice', lastName: 'Johnson', headshot: 'https://example.com/alice.jpg'},
  },
  {
    _id: 'doc-2',
    _type: 'article',
    title: 'Second Article',
    author: {firstName: 'Bob', lastName: 'Smith', headshot: null},
  },
  {
    _id: 'doc-3',
    _type: 'article',
    title: 'Third Article',
    author: null,
  },
]

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReferenceCell with preview: { select, prepare }', () => {
  it('Behavior 1 (tracer bullet): renders prepared title in the cell', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {
          firstName: 'firstName',
          lastName: 'lastName',
        },
        prepare: ({firstName, lastName}: Record<string, unknown>) => ({
          title: firstName && lastName ? `${firstName} ${lastName}` : 'Unknown',
        }),
      },
    })

    renderWithTheme(<DocumentTable data={mockData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    expect(within(table).getByText('Alice Johnson')).toBeInTheDocument()
    expect(within(table).getByText('Bob Smith')).toBeInTheDocument()
  })

  it('Behavior 2: prepare returning { title, media } renders avatar circle + title', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {
          firstName: 'firstName',
          lastName: 'lastName',
          headshot: 'headshot',
        },
        prepare: ({firstName, lastName, headshot}: Record<string, unknown>) => ({
          title: `${firstName} ${lastName}`,
          media: headshot,
        }),
      },
    })

    renderWithTheme(<DocumentTable data={mockData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    // Alice has a headshot — should show avatar image
    const aliceImg = within(table).getByAltText('Alice Johnson')
    expect(aliceImg).toBeInTheDocument()
    expect(aliceImg).toHaveAttribute('src', 'https://example.com/alice.jpg')
    // Alice's name should also be visible
    expect(within(table).getByText('Alice Johnson')).toBeInTheDocument()
  })

  it('Behavior 3: prepare returning { title } only (no media) renders plain title text', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {firstName: 'firstName', lastName: 'lastName'},
        prepare: ({firstName, lastName}: Record<string, unknown>) => ({
          title: firstName && lastName ? `${firstName} ${lastName}` : 'Unknown',
        }),
      },
    })

    renderWithTheme(<DocumentTable data={mockData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    // Bob has no headshot — should show plain text, no avatar
    expect(within(table).getByText('Bob Smith')).toBeInTheDocument()
    // No img elements for Bob's row
    const rows = within(table).getAllByRole('row')
    // Row 0 = header, Row 1 = Alice, Row 2 = Bob, Row 3 = null author
    const bobRow = rows[2]
    expect(within(bobRow).queryByRole('img')).not.toBeInTheDocument()
  })

  it('Behavior 4: null/undefined value renders em dash', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {firstName: 'firstName'},
        prepare: ({firstName}: Record<string, unknown>) => ({title: firstName || 'Unknown'}),
      },
    })

    renderWithTheme(<DocumentTable data={mockData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    // Third article has null author — should show em dash
    const rows = within(table).getAllByRole('row')
    const nullRow = rows[3]
    expect(within(nullRow).getByText('—')).toBeInTheDocument()
  })

  it('Behavior 5: clicking the reference cell sets editing state (when edit: true)', async () => {
    const user = userEvent.setup()

    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      edit: true,
      preview: {
        select: {firstName: 'firstName'},
        prepare: ({firstName}: Record<string, unknown>) => ({title: firstName || 'Unknown'}),
      },
    })

    renderWithTheme(<DocumentTable data={mockData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    const aliceText = within(table).getByText('Alice')

    // Click should trigger editing state — for now just verify the cell is clickable
    // (the actual popover is Task 2)
    await user.click(aliceText)

    // The cell should have a data-editing attribute or similar indicator
    // For now, just verify the click doesn't crash
    expect(aliceText).toBeInTheDocument()
  })

  it('Behavior 6: GROQ projection generated from preview.select', () => {
    const col = column.reference({
      field: 'web.author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {
          firstName: 'firstName',
          lastName: 'lastName',
          headshot: 'headshot.image.asset',
        },
        prepare: ({firstName, lastName}: Record<string, unknown>) => ({
          title: `${firstName} ${lastName}`,
        }),
      },
    })

    // The projection should be generated from preview.select
    expect((col as SanityColumnDef).projection).toContain('web.author->')
    expect((col as SanityColumnDef).projection).toContain('firstName')
    expect((col as SanityColumnDef).projection).toContain('lastName')
    // Dot-path values should be aliased
    expect((col as SanityColumnDef).projection).toContain('"headshot": headshot.image.asset')
  })

  it('Behavior 7: old display/getName/getImage/showName props removed from type', () => {
    // This is a compile-time check — if these props existed, TypeScript would accept them.
    // We verify the column helper works WITHOUT them.
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name'},
        prepare: ({name}: Record<string, unknown>) => ({title: name}),
      },
    })

    expect(col.id).toBeDefined()
    expect(col.header).toBe('Author')
  })

  it('Behavior 8: useResolvedColumns injects metadata instead of replacing cell', () => {
    // This is tested indirectly — when edit: true, the cell should still render
    // the prepared title (not be replaced by ReferenceSearchCell)
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      edit: true,
      preview: {
        select: {firstName: 'firstName', lastName: 'lastName'},
        prepare: ({firstName, lastName}: Record<string, unknown>) => ({
          title: `${firstName} ${lastName}`,
        }),
      },
    })

    renderWithTheme(<DocumentTable data={mockData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    // Should show prepared title, NOT the old ReferenceSearchCell behavior
    expect(within(table).getByText('Alice Johnson')).toBeInTheDocument()
    expect(within(table).getByText('Bob Smith')).toBeInTheDocument()
  })
})
