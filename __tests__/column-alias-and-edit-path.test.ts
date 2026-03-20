import {column} from '@sanetti/sanity-table-kit'
import type {ColumnDef} from '@sanetti/sanity-table-kit'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {resolveColumnAliases} from '../src/resolveColumnAliases'

describe('Cell accessor — projected alias resolution', () => {
  it('Behavior 1: simple field column keeps field unchanged', () => {
    const cols = resolveColumnAliases([column.title()])
    expect(cols[0].field).toBe('title')
  })

  it('Behavior 2: dot-path column field is rewritten to alias', () => {
    const cols = resolveColumnAliases([column.date({field: 'web.dueDate', header: 'Due Date'})])
    // field is now the alias — DocumentTable reads row.dueDate
    expect(cols[0].field).toBe('dueDate')
  })

  it('Behavior 3: function expression column field is rewritten to alias', () => {
    const cols = resolveColumnAliases([
      column.badge({field: 'coalesce(status, "draft")', colorMap: {draft: 'caution'}}),
    ])
    expect(cols[0].field).toBe('status')
  })

  it('Behavior 4: custom column with projection uses id (no field rewrite needed)', () => {
    const col = {
      ...column.custom({field: 'enteredStageAt', header: 'Time in Stage'}),
      projection: 'statuses[-1].completedAt',
    }
    const cols = resolveColumnAliases([col])
    expect(cols[0].id).toBe('enteredStageAt')
  })

  it('Behavior 5: edit config preserves real document path in _field', () => {
    const cols = resolveColumnAliases([
      column.date({field: 'web.dueDate', edit: true, header: 'Due Date'}),
    ])
    // field is rewritten to alias for reading
    expect(cols[0].field).toBe('dueDate')
    // But edit._field preserves the real document path for patching
    expect(cols[0].edit?._field).toBe('web.dueDate')
  })
})

// Mock SDK modules
vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue({}),
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: vi.fn((_handle, patches) => ({
    type: 'document.edit',
    patches: [patches],
  })),
}))

import {editDocument} from '@sanity/sdk'
import {renderHook} from '@testing-library/react'

// Import after mocks
import {useResolvedColumns} from '../src/useResolvedColumns'

describe('Edit path resolution — auto-extract document path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('Behavior 1: edit:true on simple field patches the field name directly', () => {
    const cols = resolveColumnAliases([column.title({edit: true})] as ColumnDef[])

    const {result} = renderHook(() => useResolvedColumns(cols))
    const resolved = result.current
    const titleCol = resolved[0]

    // Trigger onSave
    titleCol.edit!.onSave!({_id: 'doc1', _type: 'article'}, 'New Title')

    expect(editDocument).toHaveBeenCalledWith({documentId: 'doc1'}, {set: {title: 'New Title'}})
  })

  it('Behavior 2: edit:true on dot-path patches the FULL dot-path', () => {
    const cols = resolveColumnAliases([
      column.date({field: 'web.dueDate', edit: true, header: 'Due Date'}),
    ] as ColumnDef[])

    // After resolveColumnAliases: field='dueDate', edit._field='web.dueDate'
    expect(cols[0].field).toBe('dueDate')
    expect(cols[0].edit?._field).toBe('web.dueDate')

    const {result} = renderHook(() => useResolvedColumns(cols))
    const resolved = result.current
    const dateCol = resolved[0]

    dateCol.edit!.onSave!({_id: 'doc1', _type: 'article'}, '2027-01-14')

    expect(editDocument).toHaveBeenCalledWith(
      {documentId: 'doc1'},
      {set: {'web.dueDate': '2027-01-14'}},
    )
  })

  it('Behavior 3: edit:true on function expression patches the first field ref', () => {
    const cols = resolveColumnAliases([
      column.badge({field: 'coalesce(status, "draft")', colorMap: {draft: 'caution'}, edit: true}),
    ] as ColumnDef[])

    // After resolveColumnAliases: field='status', edit._field='status'
    expect(cols[0].field).toBe('status')
    expect(cols[0].edit?._field).toBe('status')

    const {result} = renderHook(() => useResolvedColumns(cols))
    const resolved = result.current
    const badgeCol = resolved[0]

    badgeCol.edit!.onSave!({_id: 'doc1', _type: 'article'}, 'published')

    expect(editDocument).toHaveBeenCalledWith({documentId: 'doc1'}, {set: {status: 'published'}})
  })

  it('Behavior 4: column without edit config is unchanged', () => {
    const cols = resolveColumnAliases([
      column.date({field: 'web.dueDate', header: 'Due Date'}), // no edit
    ] as ColumnDef[])

    const {result} = renderHook(() => useResolvedColumns(cols))
    const resolved = result.current

    expect(resolved[0].edit).toBeUndefined()
  })

  it('Behavior 5: explicit onSave is preserved (not overridden by auto-save)', () => {
    const customSave = vi.fn()
    const cols = resolveColumnAliases([
      column.title({edit: {mode: 'text' as const, onSave: customSave}}),
    ] as ColumnDef[])

    const {result} = renderHook(() => useResolvedColumns(cols))
    const resolved = result.current
    const titleCol = resolved[0]

    titleCol.edit!.onSave!({_id: 'doc1', _type: 'article'}, 'New Title')

    // Should use the custom onSave, not the auto-save
    expect(customSave).toHaveBeenCalledWith({_id: 'doc1', _type: 'article'}, 'New Title')
    // editDocument should NOT have been called
    expect(editDocument).not.toHaveBeenCalled()
  })
})
