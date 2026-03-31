import type {ColumnDef, DocumentBase} from '@sanetti/sanity-table-kit'
import type {PreviewConfig, PreviewValue} from '@sanity/types'
import type {ReactNode} from 'react'

interface SanityColumnEditConfig<
  TDocument extends DocumentBase = DocumentBase,
  TSelect extends Record<string, string> = Record<string, string>,
  TPrepareValue extends PreviewValue = PreviewValue,
> {
  mode: 'select' | 'text' | 'date' | 'custom'
  options?: Array<{value: string; label: string; tone?: string}>
  component?: (props: {
    value: unknown
    document: TDocument
    onChange: (newValue: string) => void
    onClose: () => void
  }) => ReactNode
  onSave?: (document: TDocument, newValue: string) => void
  _autoSave?: boolean
  _field?: string
  _toneByDateRange?: boolean
  _referenceType?: string
  _preview?: Required<Pick<PreviewConfig<TSelect, TPrepareValue>, 'select' | 'prepare'>>
  _placeholder?: string
}

/**
 * Extended column definition with SDK-specific properties.
 * Adds `projection` for custom GROQ projection expressions.
 */
export interface SanityColumnDef<TDocument extends DocumentBase = DocumentBase> extends Omit<
  ColumnDef<TDocument>,
  'edit'
> {
  /** Custom GROQ projection expression for this column. */
  projection?: string
  /** Internal preview metadata reused by reference filters when available. */
  _referencePreview?: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  /** Internal reference target type metadata reused by reference-aware features. */
  _referenceType?: string
  /** SDK-specific edit metadata for reference columns. */
  edit?: SanityColumnEditConfig<TDocument>
}

/**
 * Result of parsing a field expression.
 * Used to determine GROQ projection alias, cell accessor key, and edit patch path.
 */
export interface ParsedFieldExpression {
  /** The key used in the GROQ projection and to read from the result row. */
  alias: string
  /** The full GROQ expression used in the projection. */
  expression: string
  /** The document field path used for edit patches. */
  editPath: string
  /** Whether this is a simple field name (no dots, no functions). */
  isSimple: boolean
}

/**
 * Parse a field string that may be a simple field name, a dot-path,
 * or a GROQ function expression.
 *
 * Examples:
 * - `'title'` → `{alias: 'title', expression: 'title', editPath: 'title', isSimple: true}`
 * - `'web.dueDate'` → `{alias: 'dueDate', expression: 'web.dueDate', editPath: 'web.dueDate', isSimple: false}`
 * - `'coalesce(status, "draft")'` → `{alias: 'status', expression: 'coalesce(status, "draft")', editPath: 'status', isSimple: false}`
 */
export function parseFieldExpression(field: string): ParsedFieldExpression {
  // Check if it's a function call: contains '(' before any '.'
  const parenIndex = field.indexOf('(')
  if (parenIndex !== -1) {
    // Extract the first argument (the field reference)
    const argsStart = parenIndex + 1
    // Find the first comma or closing paren to get the first arg
    let depth = 0
    let firstArgEnd = field.length
    for (let i = argsStart; i < field.length; i++) {
      if (field[i] === '(') depth++
      else if (field[i] === ')') {
        if (depth === 0) {
          firstArgEnd = i
          break
        }
        depth--
      } else if (field[i] === ',' && depth === 0) {
        firstArgEnd = i
        break
      }
    }
    const firstArg = field.slice(argsStart, firstArgEnd).trim()

    // The first arg might be a dot-path itself
    const parsed = parseFieldExpression(firstArg)
    return {
      alias: parsed.alias,
      expression: field,
      editPath: parsed.editPath,
      isSimple: false,
    }
  }

  // Check for array index notation: statuses[-1].completedAt
  // Check for dot-path: web.dueDate
  if (field.includes('.') || field.includes('[')) {
    // Extract the last segment after the last dot
    const lastDotIndex = field.lastIndexOf('.')
    const alias = lastDotIndex !== -1 ? field.slice(lastDotIndex + 1) : field
    return {
      alias,
      expression: field,
      editPath: field,
      isSimple: false,
    }
  }

  // Simple field name
  return {
    alias: field,
    expression: field,
    editPath: field,
    isSimple: true,
  }
}

/**
 * Generates a GROQ projection string from column definitions.
 * Always includes `_id` and `_type`. Deduplicates fields.
 *
 * Column fields are treated as GROQ expressions:
 * - Simple fields ('title') → included directly
 * - Dot-paths ('web.dueDate') → aliased: `"dueDate": web.dueDate`
 * - Functions ('coalesce(status, "draft")') → aliased: `"status": coalesce(status, "draft")`
 *
 * @param columns - Array of column definitions
 * @returns GROQ projection string, e.g. `"{ _id, _type, title, \"dueDate\": web.dueDate }"`
 */
export function useColumnProjection(columns: (ColumnDef | SanityColumnDef)[]): string {
  // Track simple fields for deduplication
  const simpleFields = new Set<string>(['_id', '_type'])
  // Track aliased projections separately (keyed by alias for dedup)
  const aliasedProjections = new Map<string, string>()

  for (const col of columns) {
    // Skip internal columns like _select
    if (col._isSelectColumn) continue

    // Check for custom GROQ projection (explicit override)
    const sanityCol = col as SanityColumnDef
    if (sanityCol.projection) {
      // Use the parsed alias (not col.id) — col.id may be a dot-path like 'web.author'
      // which is invalid as a GROQ alias. parseFieldExpression extracts the last segment.
      const projAlias = col.field ? parseFieldExpression(col.field).alias : col.id
      aliasedProjections.set(projAlias, `"${projAlias}": ${sanityCol.projection}`)
      continue
    }

    // Only add to projection if the column has an explicit field
    // Columns without a field (like openInStudio, _preview, _select) are UI-only
    if (!col.field) continue

    // Parse the field expression
    const parsed = parseFieldExpression(col.field)

    if (parsed.isSimple) {
      simpleFields.add(parsed.alias)
    } else {
      // Non-simple expressions get aliased
      if (!aliasedProjections.has(parsed.alias)) {
        aliasedProjections.set(parsed.alias, `"${parsed.alias}": ${parsed.expression}`)
      }
    }
  }

  const parts = [...simpleFields, ...aliasedProjections.values()]
  return `{ ${parts.join(', ')} }`
}
