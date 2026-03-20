import {column} from '@sanetti/sanity-table-kit'
import {describe, it, expect} from 'vitest'

import {useColumnProjection, parseFieldExpression} from '../src/useColumnProjection'

describe('parseFieldExpression', () => {
  it('Behavior 1: simple field returns field as-is for alias, expression, and editPath', () => {
    const result = parseFieldExpression('title')
    expect(result).toEqual({
      alias: 'title',
      expression: 'title',
      editPath: 'title',
      isSimple: true,
    })
  })

  it('Behavior 2: dot-path extracts last segment as alias, full path as editPath', () => {
    const result = parseFieldExpression('web.dueDate')
    expect(result).toEqual({
      alias: 'dueDate',
      expression: 'web.dueDate',
      editPath: 'web.dueDate',
      isSimple: false,
    })
  })

  it('Behavior 3: function expression extracts first field ref as alias and editPath', () => {
    const result = parseFieldExpression('coalesce(status, "draft")')
    expect(result).toEqual({
      alias: 'status',
      expression: 'coalesce(status, "draft")',
      editPath: 'status',
      isSimple: false,
    })
  })

  it('Behavior 4: function with dot-path first arg extracts last segment as alias', () => {
    const result = parseFieldExpression('coalesce(web.dueDate, "")')
    expect(result).toEqual({
      alias: 'dueDate',
      expression: 'coalesce(web.dueDate, "")',
      editPath: 'web.dueDate',
      isSimple: false,
    })
  })

  it('Behavior 5: array index expression extracts field name as alias', () => {
    const result = parseFieldExpression('statuses[-1].completedAt')
    expect(result).toEqual({
      alias: 'completedAt',
      expression: 'statuses[-1].completedAt',
      editPath: 'statuses[-1].completedAt',
      isSimple: false,
    })
  })

  it('Behavior 6: deeply nested dot-path extracts last segment', () => {
    const result = parseFieldExpression('web.social.twitter.handle')
    expect(result).toEqual({
      alias: 'handle',
      expression: 'web.social.twitter.handle',
      editPath: 'web.social.twitter.handle',
      isSimple: false,
    })
  })
})

describe('useColumnProjection — field-as-projection', () => {
  it('Behavior 1 (tracer): simple field still works as before', () => {
    const cols = [column.title(), column.updatedAt()]
    const projection = useColumnProjection(cols)
    expect(projection).toBe('{ _id, _type, title, _updatedAt }')
  })

  it('Behavior 2: dot-path field generates aliased projection', () => {
    const cols = [column.date({field: 'web.dueDate', header: 'Due Date'})]
    const projection = useColumnProjection(cols)
    expect(projection).toContain('"dueDate": web.dueDate')
  })

  it('Behavior 3: function expression generates aliased projection', () => {
    const cols = [
      column.badge({
        field: 'coalesce(status, "draft")',
        colorMap: {draft: 'caution', published: 'positive'},
      }),
    ]
    const projection = useColumnProjection(cols)
    expect(projection).toContain('"status": coalesce(status, "draft")')
  })

  it('Behavior 4: custom column with projection prop still uses explicit projection', () => {
    const cols = [
      {
        ...column.custom({field: 'enteredStageAt', header: 'Time in Stage'}),
        projection: 'statuses[-1].completedAt',
      },
    ]
    const projection = useColumnProjection(cols)
    expect(projection).toContain('"enteredStageAt": statuses[-1].completedAt')
  })

  it('Behavior 5: reference column with dot-path generates dereference projection', () => {
    // This tests the SDK column.reference — import from sanity package
    // For now, test with a manually constructed SanityColumnDef
    const cols = [
      {
        id: 'author',
        header: 'Author',
        field: 'web.author',
        projection: 'web.author->{firstName, lastName}',
      },
    ]
    const projection = useColumnProjection(cols)
    expect(projection).toContain('"author": web.author->{firstName, lastName}')
  })

  it('Behavior 6: mixed columns — simple + dot-path + function all in one projection', () => {
    const cols = [
      column.title(),
      column.type(),
      column.date({field: 'web.dueDate', header: 'Due Date'}),
      column.badge({field: 'coalesce(status, "draft")', colorMap: {draft: 'caution'}}),
    ]
    const projection = useColumnProjection(cols)
    // Simple fields
    expect(projection).toContain('title')
    expect(projection).toContain('_type')
    // Aliased projections
    expect(projection).toContain('"dueDate": web.dueDate')
    expect(projection).toContain('"status": coalesce(status, "draft")')
  })

  it('Behavior 7: _isSelectColumn and UI-only columns are still skipped', () => {
    const cols = [column.select(), column.openInStudio(), column.title()]
    const projection = useColumnProjection(cols)
    // Should only have _id, _type, title — no _select or openInStudio fields
    expect(projection).toBe('{ _id, _type, title }')
  })

  it('Behavior 8: duplicate alias from different expressions deduplicates', () => {
    // Two columns that would produce the same alias
    const cols = [
      column.title(),
      column.title(), // duplicate
    ]
    const projection = useColumnProjection(cols)
    const matches = projection.match(/title/g)
    expect(matches).toHaveLength(1)
  })
})

describe('useColumnProjection — edge cases', () => {
  it('always includes _id and _type even with zero columns', () => {
    const projection = useColumnProjection([])
    expect(projection).toBe('{ _id, _type }')
  })

  it('custom GROQ projection uses aliased syntax', () => {
    // SDK-specific: add projection property to column def
    const cols = [
      {
        ...column.custom({field: 'sectionName', header: 'Section'}),
        projection: 'section->name',
      },
    ]
    const projection = useColumnProjection(cols)
    expect(projection).toContain('"sectionName": section->name')
  })

  it('uses column.field over column.id for projection field name', () => {
    // column.type() has id='type' but field='_type'
    // column.title() has id='title' but field='title' (same)
    // column.updatedAt() has id='updatedAt' but field='_updatedAt'
    const cols = [column.type(), column.updatedAt()]
    const projection = useColumnProjection(cols)
    // Should use _type (field) not 'type' (id)
    expect(projection).not.toContain(', type')
    // Should use _updatedAt (field) not 'updatedAt' (id)
    expect(projection).not.toContain('updatedAt,')
    expect(projection).toContain('_updatedAt')
  })
})
