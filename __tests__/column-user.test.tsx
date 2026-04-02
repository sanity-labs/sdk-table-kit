import {DocumentTable} from '@sanetti/sanity-table-kit'
import {screen, within} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi} from 'vitest'

import {column} from '../src'
import {renderWithTheme} from './helpers'

// Mock useUsers from @sanity/sdk-react
vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useUsers: vi.fn(() => ({
    data: [
      {
        profile: {
          displayName: 'Alice Johnson',
          email: 'alice@example.com',
          imageUrl: 'https://example.com/alice.jpg',
        },
        memberships: [{resourceUserId: 'res-user-1'}],
      },
      {
        profile: {displayName: 'Bob Smith', email: 'bob@example.com', imageUrl: undefined},
        memberships: [{resourceUserId: 'res-user-2'}],
      },
    ],
    hasMore: false,
    isPending: false,
    loadMore: vi.fn(),
  })),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

const mockData = [
  {_id: 'doc-1', _type: 'article', title: 'Alpha', assignedTo: 'res-user-1'},
  {_id: 'doc-2', _type: 'article', title: 'Beta', assignedTo: 'res-user-2'},
  {_id: 'doc-3', _type: 'article', title: 'Gamma', assignedTo: null},
  {_id: 'doc-4', _type: 'article', title: 'Delta', assignedTo: ''},
]

describe('column.user()', () => {
  it('Behavior 7: creates column def with _resolveUser marker', () => {
    const col = column.user({field: 'assignedTo', header: 'Assigned To'})
    expect(col.id).toBe('assignedTo')
    expect(col.header).toBe('Assigned To')
    expect(col.field).toBe('assignedTo')
  })

  it('Behavior 8: resolves userId to user profile and renders avatar', () => {
    renderWithTheme(
      <DocumentTable
        data={[mockData[0]]}
        columns={[column.title(), column.user({field: 'assignedTo', header: 'Assigned To'})]}
      />,
    )

    const table = screen.getByRole('table')
    // Should resolve res-user-1 to Alice Johnson and show avatar with image
    expect(within(table).getByTitle('Alice Johnson')).toBeInTheDocument()
    // Alice has an imageUrl, so renders img instead of initial
    expect(within(table).getByAltText('Alice Johnson')).toBeInTheDocument()
  })

  it('Behavior 9: shows em dash when userId is null/empty or user not found', () => {
    renderWithTheme(
      <DocumentTable
        data={[mockData[2], mockData[3]]}
        columns={[column.title(), column.user({field: 'assignedTo', header: 'Assigned To'})]}
      />,
    )

    const table = screen.getByRole('table')
    const dashes = within(table).getAllByText('—')
    expect(dashes.length).toBe(2)
  })

  it('Behavior 10: showName displays resolved display name next to avatar', () => {
    renderWithTheme(
      <DocumentTable
        data={[mockData[0]]}
        columns={[
          column.title(),
          column.user({field: 'assignedTo', header: 'Assigned To', showName: true}),
        ]}
      />,
    )

    const table = screen.getByRole('table')
    const assignedCell = within(table).getAllByRole('cell')[1]
    expect(within(assignedCell).getByText('Alice Johnson')).toBeInTheDocument()
  })
})
