import {describe, expect, it, vi} from 'vitest'
import {column as baseColumn} from '../../table-kit/src/columns'

// We test the SDK-native column helpers from table-kit-sanity
// which wrap the base helpers to accept `edit: true`
import {column} from '../src/column'

/**
 * edit: true shorthand on SDK-native column helpers.
 *
 * When `edit: true` is passed to a built-in column helper from
 * @sanetti/sanity-sdk-table-kit, it marks the column for auto-save
 * via the Sanity SDK. The SanityDocumentTable component resolves
 * these markers at render time using useSDKEditHandler.
 *
 * | Helper        | edit: true resolves to | Field used     |
 * |---------------|------------------------|----------------|
 * | column.title  | mode: 'text'           | 'title' or arg |
 * | column.type   | mode: 'select'         | '_type'        |
 * | column.updatedAt | mode: 'date'        | '_updatedAt'   |
 * | column.badge  | mode: 'select'         | field arg      |
 * | column.date   | mode: 'date'           | field arg      |
 */
describe('edit: true shorthand', () => {
  // ── column.title ──────────────────────────────────────────────────────

  it('Behavior 1: column.title({ edit: true }) marks column as auto-editable text', () => {
    const col = column.title({edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('text')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('title')
  })

  it('Behavior 2: column.title with custom field and edit: true uses the custom field', () => {
    const col = column.title({field: 'name', edit: true})

    expect(col.edit!.mode).toBe('text')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('name')
  })

  it('Behavior 3: column.title({ edit: { onSave } }) still works (explicit handler)', () => {
    const onSave = vi.fn()
    const col = column.title({edit: {onSave}})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('text')
    expect(col.edit!.onSave).toBe(onSave)
    expect(col.edit!._autoSave).toBeUndefined()
  })

  // ── column.type ───────────────────────────────────────────────────────

  it('Behavior 4: column.type({ edit: true }) marks column as auto-editable select', () => {
    const col = column.type({edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('select')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('_type')
  })

  // ── column.updatedAt ──────────────────────────────────────────────────

  it('Behavior 5: column.updatedAt({ edit: true }) marks column as auto-editable date', () => {
    const col = column.updatedAt({edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('date')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('_updatedAt')
  })

  // ── column.badge ──────────────────────────────────────────────────────

  it('Behavior 6: column.badge with edit: true marks column as auto-editable select', () => {
    const col = column.badge({field: 'status', colorMap: {draft: 'caution'}, edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('select')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('status')
  })

  // ── column.date ───────────────────────────────────────────────────────

  it('Behavior 7: column.date with edit: true marks column as auto-editable date', () => {
    const col = column.date({field: 'dueDate', edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('date')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('dueDate')
  })

  // ── No edit ───────────────────────────────────────────────────────────

  it('Behavior 8: columns without edit have no edit property (regression)', () => {
    expect(column.title().edit).toBeUndefined()
    expect(column.type().edit).toBeUndefined()
    expect(column.updatedAt().edit).toBeUndefined()
    expect(column.badge({field: 'status'}).edit).toBeUndefined()
    expect(column.date({field: 'dueDate'}).edit).toBeUndefined()
  })
})
