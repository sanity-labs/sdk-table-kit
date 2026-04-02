import {DocumentTable} from '@sanetti/sanity-table-kit'
import {screen, within} from '@testing-library/react'
import React from 'react'
import {describe, it, expect} from 'vitest'

import {column} from '../src'
import {renderWithTheme} from './helpers'

// Mock data: reference columns resolve to the dereferenced value at query time.
// With the new API, the resolved value is an object shaped by preview.select.
// prepare() maps that object to { title, subtitle?, media? }.
const mockData = [
  {_id: 'doc-1', _type: 'article', title: 'Alpha', author: {name: 'Alice Johnson'}},
  {_id: 'doc-2', _type: 'article', title: 'Beta', author: {name: 'Bob Smith'}},
]

describe('column.reference() with preview', () => {
  it('Behavior 1: renders prepared title as plain text when no media', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: name}),
      },
    })

    renderWithTheme(<DocumentTable data={mockData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    expect(within(table).getByText('Alice Johnson')).toBeInTheDocument()
    expect(within(table).getByText('Bob Smith')).toBeInTheDocument()
    expect(within(table).queryByTestId('reference-avatar')).not.toBeInTheDocument()
  })

  it('Behavior 2: prepare() with media renders avatar circle + title', () => {
    const objectData = [
      {
        _id: 'doc-1',
        _type: 'article',
        title: 'Alpha',
        author: {
          firstName: 'Alice',
          lastName: 'Johnson',
          imageUrl: 'https://example.com/alice.jpg',
        },
      },
      {
        _id: 'doc-2',
        _type: 'article',
        title: 'Beta',
        author: {firstName: 'Bob', lastName: 'Smith', imageUrl: null},
      },
    ]

    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {firstName: 'firstName', lastName: 'lastName', imageUrl: 'imageUrl'},
        prepare: ({firstName, lastName, imageUrl}: Record<string, unknown>) => ({
          title: `${firstName} ${lastName}`,
          media: imageUrl,
        }),
      },
    })

    renderWithTheme(<DocumentTable data={objectData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    // Alice has media — should show avatar image + title
    expect(within(table).getByAltText('Alice Johnson')).toBeInTheDocument()
    expect(within(table).getByText('Alice Johnson')).toBeInTheDocument()
    // Bob has null media — should show initial letter + title
    expect(within(table).getByText('Bob Smith')).toBeInTheDocument()
  })

  it('Behavior 3: prepare() returning media renders profile image inside avatar circle', () => {
    const imageData = [
      {
        _id: 'doc-1',
        _type: 'article',
        title: 'Alpha',
        author: {name: 'Alice', imageUrl: 'https://example.com/alice.jpg'},
      },
    ]

    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name', imageUrl: 'imageUrl'},
        prepare: ({name, imageUrl}: Record<string, unknown>) => ({title: name, media: imageUrl}),
      },
    })

    renderWithTheme(<DocumentTable data={imageData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    const img = within(table).getByAltText('Alice')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/alice.jpg')
  })

  it('Behavior 4: title is always shown next to avatar when media present', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name', imageUrl: 'imageUrl'},
        prepare: ({name, imageUrl}: Record<string, unknown>) => ({
          title: name,
          media: imageUrl || undefined,
        }),
      },
    })

    const dataWithImage = [
      {
        _id: 'doc-1',
        _type: 'article',
        title: 'Alpha',
        author: {name: 'Alice Johnson', imageUrl: 'https://example.com/alice.jpg'},
      },
    ]

    renderWithTheme(<DocumentTable data={dataWithImage} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    // Full name shown as text next to avatar
    const authorCell = within(table).getAllByRole('cell')[1]
    expect(within(authorCell).getByText('Alice Johnson')).toBeInTheDocument()
    expect(within(authorCell).getByAltText('Alice Johnson')).toBeInTheDocument()
  })

  it('Behavior 5: shows em dash for null/empty resolved values', () => {
    const nullData = [
      {_id: 'doc-1', _type: 'article', title: 'Alpha', author: null},
      {_id: 'doc-2', _type: 'article', title: 'Beta', author: ''},
    ]

    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: name}),
      },
    })

    renderWithTheme(<DocumentTable data={nullData} columns={[column.title(), col]} />)

    const table = screen.getByRole('table')
    const dashes = within(table).getAllByText('—')
    expect(dashes.length).toBe(2)
  })

  it('Behavior 6: sortValue uses prepare().title automatically', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {firstName: 'firstName', lastName: 'lastName'},
        prepare: ({firstName, lastName}: Record<string, unknown>) => ({
          title: `${firstName} ${lastName}`,
        }),
      },
    })

    // sortValue should be set and use prepare().title
    expect(col.sortValue).toBeDefined()
    expect(col.sortValue!({firstName: 'Bob', lastName: 'Smith'})).toBe('Bob Smith')
  })
})
