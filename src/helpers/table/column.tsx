import {column as baseColumn} from '@sanetti/sanity-table-kit'
import type {DocumentBase} from '@sanetti/sanity-table-kit'
import type {PreviewConfig, PreviewValue} from '@sanity/types'
import React from 'react'

import {CommentableCell} from '../../components/comments/CommentableCell'
import {ReferenceCell} from '../../components/references/ReferenceCell'
import {DocumentStatusCell, getStatusSortPriority} from '../../components/status/DocumentStatusCell'
import {OpenInStudioCell} from '../../components/table/OpenInStudioCell'
import {PreviewCell} from '../../components/table/PreviewCell'
import {TaskSummaryCellView} from '../../components/tasks/TaskSummaryCellView'
import {UserCell} from '../../components/users/UserCell'
import {
  parseFieldExpression,
  type CellCommentsConfig,
  type SanityColumnDef,
} from '../../hooks/useColumnProjection'

/**
 * Re-export for internal use — the canonical types from @sanity/types.
 */
export type {PreviewConfig, PreviewValue}

/**
 * Options for `column.reference()`.
 *
 * Uses the Studio `preview: { select, prepare }` pattern for display.
 * The `preview` prop uses `PreviewConfig` from `@sanity/types` — the same
 * type used in Sanity schema definitions.
 *
 * @typeParam TSelect - The select map shape (keys → GROQ field paths).
 * @typeParam TPrepareValue - The shape of data passed to prepare().
 */
interface ReferenceColumnConfig<
  TSelect extends Record<string, string> = Record<string, string>,
  TPrepareValue extends Record<keyof TSelect, unknown> = Record<keyof TSelect, unknown>,
> {
  /** The reference field path (e.g. 'author', 'web.author'). Required. */
  field: string
  /** Display header text. */
  header: string
  /** Document type to search when editing. Required when edit is true. */
  referenceType: string
  /**
   * Preview configuration — identical to Sanity Studio's schema preview pattern.
   * Uses `PreviewConfig` from `@sanity/types`.
   *
   * `select` maps keys to GROQ field paths; `prepare` transforms into `PreviewValue`.
   */
  preview: Required<Pick<PreviewConfig<TSelect, TPrepareValue>, 'select' | 'prepare'>>
  /** Whether this column can be sorted. */
  sortable?: boolean
  /** Optional GROQ field/expression used for server-side sorting. */
  sortField?: string
  /** Whether this column appears in the filter UI. */
  filterable?: boolean
  /** Whether rows can be grouped by this column's values. */
  groupable?: boolean
  /** Fixed column width in pixels. */
  width?: number
  /** Enable inline reference editing. */
  edit?: boolean
  /** Placeholder text for empty reference cells (e.g. "Select Author"). Defaults to "Add…". */
  placeholder?: string
  /** Enable in-cell field comments for this column. */
  comments?: boolean | Partial<CellCommentsConfig>
}

/**
 * Options for `column.user()`.
 */
interface UserColumnConfig {
  /** The userId field path. Required. */
  field: string
  /** Display header text. */
  header: string
  /** Show name next to avatar. `true` = full name, `'first'` = first name only. */
  showName?: boolean | 'first'
  /** Fixed column width in pixels. */
  width?: number
  /** Enable in-cell field comments for this column. */
  comments?: boolean | Partial<CellCommentsConfig>
}

interface CommentableConfig {
  comments?: boolean | Partial<CellCommentsConfig>
}

/**
 * Role-based visibility props — SDK-specific extension.
 * Added to all column helpers via withRoleProps wrapper.
 */
interface RoleProps {
  /** Role names (slugs) that can see this column. If unset, visible to all. */
  visibleTo?: string[]
  /** Role names (slugs) that can edit this column. If unset, edit available to all. */
  editableBy?: string[]
}

/**
 * Wrap a base column helper to accept and preserve visibleTo/editableBy props.
 * These props are stripped by the base helper (unknown to it), so we re-attach them.
 */
function withRoleProps<TConfig, TResult>(
  baseFn: (config: TConfig) => TResult,
): (config?: TConfig & RoleProps) => TResult & RoleProps {
  return (config?: TConfig & RoleProps) => {
    if (!config) return baseFn(undefined as unknown as TConfig) as TResult & RoleProps
    const {visibleTo, editableBy, ...baseConfig} = config
    const result = baseFn(baseConfig as TConfig)
    return {
      ...result,
      ...(visibleTo && {visibleTo}),
      ...(editableBy && {editableBy}),
    }
  }
}

function resolveCellComments(
  comments: CommentableConfig['comments'],
  field: string | undefined,
  header: string,
): CellCommentsConfig | undefined {
  if (!comments) return undefined

  const fallbackFieldPath = field ? parseFieldExpression(field).editPath : undefined

  if (comments === true) {
    return fallbackFieldPath ? {fieldLabel: header, fieldPath: fallbackFieldPath} : undefined
  }

  const fieldPath = comments.fieldPath ?? fallbackFieldPath
  if (!fieldPath) return undefined

  return {
    fieldLabel: comments.fieldLabel ?? header,
    fieldPath,
  }
}

function finalizeColumn<T extends SanityColumnDef>(
  columnDef: T,
  {comments, editableBy, visibleTo}: CommentableConfig & RoleProps = {},
): T & CommentableConfig & RoleProps {
  const cellComments = resolveCellComments(comments, columnDef.field, columnDef.header)

  return {
    ...columnDef,
    ...(cellComments && {
      comments: cellComments,
      cellDecorator: ({
        cellPadding,
        content,
        row,
      }: {
        cellPadding: {x: number; y: number}
        content: React.ReactNode
        row: DocumentBase
      }) => (
        <CommentableCell
          cellPadding={cellPadding}
          commentFieldLabel={cellComments.fieldLabel}
          commentFieldPath={cellComments.fieldPath}
          documentId={row._id}
          documentTitle={typeof row.title === 'string' ? row.title : undefined}
          documentType={row._type}
        >
          {content}
        </CommentableCell>
      ),
    }),
    ...(visibleTo && {visibleTo}),
    ...(editableBy && {editableBy}),
  } as T & CommentableConfig & RoleProps
}

/**
 * Build a GROQ projection string from preview.select.
 * Simple fields pass through; dot-paths get aliased.
 *
 * @example
 * ```ts
 * buildReferenceProjection('web.author', {
 *   firstName: 'firstName',
 *   lastName: 'lastName',
 *   headshot: 'headshot.image.asset',
 * })
 * // → 'web.author->{firstName, lastName, "headshot": headshot.image.asset}'
 * ```
 */
function buildReferenceProjection(field: string, select: Record<string, string>): string {
  const parts: string[] = []
  for (const [key, path] of Object.entries(select)) {
    if (path === key && !path.includes('.') && !path.includes('[')) {
      // Simple field — pass through directly
      parts.push(key)
    } else {
      // Dot-path or different key — alias it
      parts.push(`"${key}": ${path}`)
    }
  }
  // Include _id so we can identify the referenced document for edit/clear
  if (!select._id) {
    parts.push('_id')
  }
  return `${field}->{${parts.join(', ')}}`
}

/**
 * Unified column helper namespace.
 *
 * Includes all base helpers (select, title, type, custom, etc.)
 * plus SDK-specific helpers (reference, preview, user).
 *
 * All helpers accept a single keyed config object.
 *
 * @example
 * ```ts
 * import { column } from '@sanetti/sanity-sdk-table-kit'
 *
 * column.select({width: 24})
 * column.title({searchable: true, edit: true})
 * column.badge({field: 'status', colorMap: {...}, edit: true})
 * column.reference({
 *   field: 'author',
 *   header: 'Author',
 *   referenceType: 'person',
 *   preview: {
 *     select: { firstName: 'firstName', lastName: 'lastName' },
 *     prepare: ({ firstName, lastName }) => ({ title: `${firstName} ${lastName}` }),
 *   },
 * })
 * ```
 */
export const column = {
  // ── Base helpers (delegated directly to preserve full type signatures) ──

  /** {@inheritDoc} */
  select: withRoleProps(baseColumn.select),
  /** {@inheritDoc} */
  title<T extends DocumentBase = DocumentBase>(
    config?: Parameters<typeof baseColumn.title<T>>[0] & RoleProps & CommentableConfig,
  ): SanityColumnDef {
    const {comments, editableBy, visibleTo, ...baseConfig} = config ?? {}
    const col = baseColumn.title<T>(
      baseConfig as Parameters<typeof baseColumn.title<T>>[0],
    ) as SanityColumnDef
    return finalizeColumn(col, {comments, editableBy, visibleTo})
  },
  /** {@inheritDoc} */
  type: withRoleProps(baseColumn.type),
  /** {@inheritDoc} */
  updatedAt: withRoleProps(baseColumn.updatedAt),
  /**
   * Custom column with optional GROQ projection expression.
   * Extends the base custom() with a `projection` prop for computed fields.
   *
   * @example
   * ```ts
   * column.custom({
   *   field: 'enteredStageAt',
   *   header: 'Time in Stage',
   *   projection: 'statuses[-1].completedAt',
   *   cell: (value) => formatTimeAgo(value),
   * })
   * ```
   */
  custom<T extends DocumentBase = DocumentBase>(
    config: Parameters<typeof baseColumn.custom<T>>[0] &
      CommentableConfig &
      RoleProps & {
        /** GROQ projection expression for this column. */
        projection?: string
      },
  ): SanityColumnDef {
    const {comments, editableBy, projection, visibleTo, ...baseConfig} = config
    const col = baseColumn.custom<T>(baseConfig)
    const nextCol = projection
      ? ({...col, projection} as SanityColumnDef)
      : (col as SanityColumnDef)
    return finalizeColumn(nextCol, {comments, editableBy, visibleTo})
  },
  /** {@inheritDoc} */
  badge: withRoleProps(baseColumn.badge),
  /** {@inheritDoc} */
  date<T extends DocumentBase = DocumentBase>(
    config: Parameters<typeof baseColumn.date<T>>[0] & RoleProps & CommentableConfig,
  ): SanityColumnDef {
    const {comments, editableBy, visibleTo, ...baseConfig} = config
    const col = baseColumn.date<T>(
      baseConfig as Parameters<typeof baseColumn.date<T>>[0],
    ) as SanityColumnDef
    return finalizeColumn(col, {comments, editableBy, visibleTo})
  },
  /** {@inheritDoc} */
  boolean: withRoleProps(baseColumn.boolean),

  /**
   * Open in Studio action column — renders a button that navigates to the document in Sanity Studio.
   * Uses `useNavigateToStudioDocument` from `@sanity/sdk-react`.
   *
   * @example
   * ```ts
   * column.openInStudio()
   * column.openInStudio({width: 60})
   * ```
   */
  openInStudio(config?: {width?: number; header?: string}): SanityColumnDef {
    return {
      id: 'openInStudio',
      header: config?.header ?? '',
      sortable: false,
      width: config?.width ?? 44,
      cell: (_value: unknown, row: DocumentBase) => (
        <OpenInStudioCell documentId={row._id} documentType={row._type} />
      ),
    }
  },

  // ── SDK-specific helpers ───────────────────────────────────────────────

  /**
   * Reference column — resolves a reference field via GROQ dereferencing.
   *
   * Uses the Studio `preview: { select, prepare }` pattern for display.
   * `prepare` returns `{ title, subtitle?, media? }` — same shape as Studio schemas.
   *
   * @example
   * ```ts
   * column.reference({
   *   field: 'web.author',
   *   header: 'Author',
   *   referenceType: 'person',
   *   edit: true,
   *   preview: {
   *     select: {
   *       firstName: 'firstName',
   *       lastName: 'lastName',
   *       headshot: 'headshot.image.asset',
   *     },
   *     prepare: ({ firstName, lastName, headshot }) => ({
   *       title: `${firstName} ${lastName}`,
   *       subtitle: 'Author',
   *       media: headshot,
   *     }),
   *   },
   * })
   * ```
   */
  reference<
    TSelect extends Record<string, string> = Record<string, string>,
    TPrepareValue extends Record<keyof TSelect, unknown> = Record<keyof TSelect, unknown>,
  >(config: ReferenceColumnConfig<TSelect, TPrepareValue>): SanityColumnDef {
    const {
      comments,
      field,
      header,
      referenceType,
      preview,
      sortable,
      sortField,
      filterable,
      groupable,
      width,
      edit,
      placeholder,
    } = config

    // Build GROQ projection from preview.select
    const projection = buildReferenceProjection(field, preview.select)

    // Build cell renderer using prepare function
    const cell = (value: unknown, row: DocumentBase) => {
      return (
        <ReferenceCell
          value={value}
          row={row}
          prepare={preview.prepare as (data: Record<string, unknown>) => PreviewValue}
          selectKeys={Object.keys(preview.select)}
        />
      )
    }

    const col: SanityColumnDef = {
      id: field,
      header,
      field,
      projection,
      cell,
      _referencePreview: preview as Required<Pick<PreviewConfig, 'select' | 'prepare'>>,
      _referenceType: referenceType,
      ...(sortField && {_serverSortField: sortField}),
      ...(sortable != null && {sortable}),
      ...(filterable != null && {filterable}),
      ...(groupable != null && {groupable}),
      ...(width != null && {width}),
      // Sort by prepared title
      sortValue: (rawValue: unknown) => {
        if (rawValue == null) return ''
        try {
          const prepared = (preview.prepare as (data: Record<string, unknown>) => PreviewValue)(
            rawValue as Record<string, unknown>,
          )
          return prepared.title ?? ''
        } catch {
          return ''
        }
      },
      // Add edit config for reference columns — metadata injection, NOT cell replacement
      ...(edit && {
        edit: {
          mode: 'custom',
          _autoSave: true,
          _field: field,
          _referenceType: referenceType,
          // Store preview config for the edit popover to use
          _preview: preview as Required<Pick<PreviewConfig, 'select' | 'prepare'>>,
          _placeholder: placeholder,
        },
      }),
    }
    return finalizeColumn(col, {comments})
  },

  /**
   * Preview column — renders document preview using SDK's useDocumentPreview.
   */
  preview(config?: {header?: string; width?: number}): SanityColumnDef {
    return {
      id: '_preview',
      header: config?.header ?? 'Preview',
      sortable: false,
      ...(config?.width != null && {width: config.width}),
      cell: (value: unknown, row: DocumentBase) => {
        return <PreviewCell documentId={row._id} documentType={row._type} />
      },
    }
  },

  /**
   * User column — resolves a userId string to a user profile with avatar.
   *
   * Uses the SDK's useUsers() hook to resolve user IDs to profiles.
   * Renders as an avatar circle with optional name display.
   *
   * @example
   * ```ts
   * column.user({field: 'assignedTo', header: 'Assigned To', showName: 'first'})
   * ```
   */
  user(config: UserColumnConfig): SanityColumnDef {
    const {comments, field, header, showName, width} = config
    const col: SanityColumnDef = {
      id: field,
      header,
      field,
      ...(width != null && {width}),
      cell: (value: unknown) => {
        if (value == null) {
          return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
        }
        return <UserCell userId={String(value)} showName={showName} />
      },
    }
    return finalizeColumn(col, {comments})
  },

  /**
   * Document status column — shows publish/draft status dots.
   *
   * Renders colored dots matching Sanity Studio conventions:
   * - Yellow dot = Draft
   * - Green dot = Published
   * - Green + Yellow dots = Modified (published with unpublished edits)
   *
   * Sortable by status priority: Draft → Published → Modified.
   *
   * @example
   * ```ts
   * column.documentStatus()
   * column.documentStatus({width: 40, header: 'Status'})
   * ```
   */
  documentStatus(config?: {width?: number; header?: string}): SanityColumnDef {
    return {
      id: '_status',
      header: config?.header ?? '',
      width: config?.width ?? 32,
      cell: (_value: unknown, row: DocumentBase) => {
        const docId = row._id || ''
        const docType = row._type || ''
        return <DocumentStatusCell documentId={docId} documentType={docType} />
      },
      sortValue: (_value: unknown, row: DocumentBase) => {
        const docId = (row._id || '') as string
        return getStatusSortPriority(docId)
      },
    }
  },

  /**
   * Task summary column — shows open/closed counts for tasks targeting the document.
   */
  tasks(config?: {header?: string; width?: number}): SanityColumnDef {
    return {
      id: '_tasks',
      header: config?.header ?? 'Tasks',
      sortable: false,
      width: config?.width ?? 140,
      cell: (_value: unknown, row: DocumentBase) => (
        <TaskSummaryCellView documentId={row._id} documentType={row._type} />
      ),
    }
  },
}
