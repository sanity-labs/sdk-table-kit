import type {SanityColumnDef} from './useColumnProjection'
import type {DocumentBase} from '@sanetti/sanity-table-kit'
import type {ReactNode} from 'react'
import React from 'react'
import {PreviewCell} from './PreviewCell'

/**
 * Options for `sanityColumn.reference()`.
 */
interface ReferenceColumnOptions {
  /** Display header text. */
  header: string
  /** GROQ field selection after dereference. e.g. 'name' or '{name, image}' */
  select: string
  /** Custom display function for the resolved reference. */
  display?: (value: unknown, row: DocumentBase) => ReactNode
  /** Whether this column can be sorted. */
  sortable?: boolean
  /** Whether this column appears in the filter UI. */
  filterable?: boolean
  /** Whether rows can be grouped by this column's values. */
  groupable?: boolean
}

/**
 * SDK-specific column helpers that extend the base table-kit column.
 * These helpers generate columns with GROQ projections for SDK-native data fetching.
 */
export const sanityColumn = {
  /**
   * Reference column — resolves a reference field via GROQ dereferencing.
   *
   * @param field - The reference field name (e.g. 'author', 'category')
   * @param opts - Column configuration including GROQ select expression
   *
   * @example
   * ```ts
   * sanityColumn.reference('author', {
   *   header: 'Author',
   *   select: 'name',
   *   display: (author) => author.name,
   * })
   * // Generates projection: "author": author->name
   * ```
   */
  reference(field: string, opts: ReferenceColumnOptions): SanityColumnDef {
    const {header, select, display, sortable, filterable, groupable} = opts

    return {
      id: field,
      header,
      field,
      projection: `${field}->${select}`,
      ...(display && {cell: display}),
      ...(sortable != null && {sortable}),
      ...(filterable != null && {filterable}),
      ...(groupable != null && {groupable}),
    }
  },

  /**
   * Preview column — renders document preview using SDK's useDocumentPreview.
   * Shows inferred title, optional subtitle, and optional media thumbnail.
   * Only needs `_id` and `_type` in the GROQ projection.
   *
   * @example
   * ```ts
   * sanityColumn.preview()
   * // Uses useDocumentPreview per row — no extra GROQ fields needed
   * ```
   */
  preview(): SanityColumnDef {
    return {
      id: '_preview',
      header: 'Preview',
      sortable: false,
      // Preview cell renders via useDocumentPreview — needs _id and _type (always included)
      // No additional field needed in projection
      cell: (value: unknown, row: DocumentBase) => {
        return React.createElement(PreviewCell, {
          documentId: row._id,
          documentType: row._type,
        })
      },
    }
  },
}
