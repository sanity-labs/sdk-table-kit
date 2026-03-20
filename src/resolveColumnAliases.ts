import type {ColumnDef, DocumentBase} from '@sanetti/sanity-table-kit'

import {parseFieldExpression} from './useColumnProjection'

/**
 * Transform columns for the SDK layer: rewrite non-simple field expressions
 * to their projected alias so the base DocumentTable reads from the correct key.
 *
 * - `field: 'web.dueDate'` → `field: 'dueDate'` (the projected alias)
 * - `field: 'coalesce(status, "draft")'` → `field: 'status'`
 * - Preserves the real document path in `edit._field` for patching
 *
 * @param columns - Column definitions with raw field expressions
 * @returns Transformed columns with aliased fields
 */
export function resolveColumnAliases<T extends DocumentBase = DocumentBase>(
  columns: ColumnDef<T>[],
): ColumnDef<T>[] {
  return columns.map((col) => {
    if (!col.field) return col

    const parsed = parseFieldExpression(col.field)
    if (parsed.isSimple) return col

    // Rewrite field AND id to the alias (what the data arrives as after GROQ projection)
    // Store the original expression's edit path for patching
    return {
      ...col,
      id: parsed.alias,
      field: parsed.alias,
      edit: col.edit
        ? {
            ...col.edit,
            _field: parsed.editPath, // Override _field with the real document path
          }
        : undefined,
    }
  })
}
