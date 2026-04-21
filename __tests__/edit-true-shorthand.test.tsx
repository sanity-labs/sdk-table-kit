import {describe, expect, it, vi} from 'vitest'

// We test the SDK-native column helpers from table-kit-sanity
// which wrap the base helpers to accept `edit: true`
import {column} from '../src/helpers/table/column'

/**
 * edit: true shorthand on SDK-native column helpers.
 *
 * When `edit: true` is passed to a built-in column helper from
 * @sanity-labs/sdk-table-kit, it marks the column for auto-save
 * via the Sanity SDK. The SanityDocumentTable component resolves
 * these markers at render time using useSDKEditHandler.
 *
 * | Helper        | edit: true resolves to | Field used     |
 * |---------------|------------------------|----------------|
 * | column.string | mode: 'text'           | field arg      |
 * | column.title  | mode: 'text'           | 'title' preset |
 * | column.type   | mode: 'select'         | '_type'        |
 * | column.updatedAt | mode: 'date'        | '_updatedAt'   |
 * | column.badge  | mode: 'select'         | field arg      |
 * | column.date   | mode: 'date'           | field arg      |
 */
describe('edit: true shorthand', () => {
  // ── column.string ─────────────────────────────────────────────────────

  it('Behavior 1: column.string({ edit: true }) marks column as auto-editable text', () => {
    const col = column.string({field: 'title', edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('text')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('title')
  })

  it('Behavior 2: column.string with custom field and edit: true uses the custom field', () => {
    const col = column.string({field: 'name', edit: true})

    expect(col.edit!.mode).toBe('text')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('name')
  })

  it('Behavior 3: column.string({ edit: { onSave } }) still works (explicit handler)', () => {
    const onSave = vi.fn()
    const col = column.string({field: 'title', edit: {onSave}})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('text')
    expect(col.edit!.onSave).toBe(onSave)
    expect(col.edit!._autoSave).toBeUndefined()
  })

  it('Behavior 4: deprecated column.title({ edit: true }) remains a compatibility preset', () => {
    const col = column.title({edit: true})

    expect(col.field).toBe('title')
    expect(col.header).toBe('Title')
    expect(col.edit!.mode).toBe('text')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('title')
  })

  // ── column.type ───────────────────────────────────────────────────────

  it('Behavior 5: column.type({ edit: true }) marks column as auto-editable select', () => {
    const col = column.type({edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('select')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('_type')
  })

  // ── column.updatedAt ──────────────────────────────────────────────────

  it('Behavior 6: column.updatedAt({ edit: true }) marks column as auto-editable date', () => {
    const col = column.updatedAt({edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('date')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('_updatedAt')
  })

  // ── column.badge ──────────────────────────────────────────────────────

  it('Behavior 7: column.badge with edit: true marks column as auto-editable select', () => {
    const col = column.badge({field: 'status', colorMap: {draft: 'caution'}, edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('select')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('status')
  })

  // ── column.date ───────────────────────────────────────────────────────

  it('Behavior 8: column.date with edit: true marks column as auto-editable date', () => {
    const col = column.date({field: 'dueDate', edit: true})

    expect(col.edit).toBeDefined()
    expect(col.edit!.mode).toBe('date')
    expect(col.edit!._autoSave).toBe(true)
    expect(col.edit!._field).toBe('dueDate')
  })

  // ── No edit ───────────────────────────────────────────────────────────

  it('Behavior 9: columns without edit have no edit property (regression)', () => {
    expect(column.string({field: 'title'}).edit).toBeUndefined()
    expect(column.title().edit).toBeUndefined()
    expect(column.type().edit).toBeUndefined()
    expect(column.updatedAt().edit).toBeUndefined()
    expect(column.badge({field: 'status'}).edit).toBeUndefined()
    expect(column.date({field: 'dueDate'}).edit).toBeUndefined()
  })
})
