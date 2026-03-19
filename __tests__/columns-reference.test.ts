import {describe, it, expect} from 'vitest'
import {useColumnProjection} from '../src/useColumnProjection'
import {column} from '../src/index'

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
})
