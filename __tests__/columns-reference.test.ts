import {describe, it, expect} from 'vitest'

import {column} from '../src'
import {getServerSortableColumnIds} from '../src/helpers/filters/getServerSortableColumnIds'
import {useColumnProjection} from '../src/hooks/useColumnProjection'

describe('columns.reference()', () => {
  it('Behavior 1: creates column def with GROQ dereference projection', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: name}),
      },
    })
    expect(col.id).toBe('author')
    expect(col.header).toBe('Author')
    expect(col.projection).toBe('author->{name, _id}')
  })

  it('Behavior 2: supports selecting multiple fields', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name', image: 'image'},
        prepare: ({name}) => ({title: name}),
      },
    })
    expect(col.projection).toBe('author->{name, image, _id}')
  })

  it('Behavior 3: cell renderer is always set (uses ReferenceCell internally)', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: name}),
      },
    })
    expect(col.cell).toBeDefined()
    expect(typeof col.cell).toBe('function')
  })

  it('Behavior 4: accepts filterable, sortable, groupable options', () => {
    const col = column.reference({
      field: 'category',
      header: 'Category',
      referenceType: 'person',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: name}),
      },
      filterable: true,
      sortable: true,
      groupable: true,
    })
    expect(col.filterable).toBe(true)
    expect(col.sortable).toBe(true)
    expect(col.groupable).toBe(true)
  })

  it('Behavior 5: projection included in useColumnProjection output', () => {
    const col = column.reference({
      field: 'author',
      header: 'Author',
      referenceType: 'person',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: name}),
      },
    })
    const projection = useColumnProjection([col])
    expect(projection).toContain('"author": author->{name, _id}')
  })

  it('Behavior 6: supports an explicit server-side sort field', () => {
    const col = column.reference({
      field: 'section',
      header: 'Section',
      referenceType: 'section',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: name}),
      },
      sortField: 'section->name',
      sortable: true,
    })

    expect(col._serverSortField).toBe('section->name')
    expect(getServerSortableColumnIds([col])).toEqual(['section'])
  })

  it('Behavior 7: reuses the prepared title for grouping and server grouping', () => {
    const col = column.reference({
      field: 'section',
      header: 'Section',
      referenceType: 'section',
      preview: {
        select: {name: 'name'},
        prepare: ({name}) => ({title: String(name)}),
      },
      sortField: 'section->name',
      groupable: true,
    })

    expect(col._serverGroupField).toBe('section->name')
    expect(col.groupValue?.({name: 'Politics'} as never, {_id: 'doc-1', _type: 'article'})).toBe(
      'Politics',
    )
  })
})
