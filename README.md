# `@sanity-labs/sdk-table-kit`

SDK-native document tables for Sanity apps built on `@sanity/sdk-react`.

![Screenshot of the App](./docs/media/table-kit-main-screenshot.avif)

This package sits on top of `@sanity-labs/react-table-kit` and adds:

- Sanity SDK-backed data fetching and pagination
- automatic GROQ projection generation from your columns
- explicit filter definitions with URL-backed state
- server-aware grouping for paginated tables
- inline editing, inline create, and release-aware staging
- Sanity-specific cells for references, users, document status, tasks, comments, and Studio links

Use `@sanity-labs/react-table-kit` when you only need UI primitives and already have table data.
Use `@sanity-labs/sdk-table-kit` when your app already uses `@sanity/sdk-react` and you want the
table to fetch and act on Sanity documents directly.

## Installation

```bash
pnpm add @sanity-labs/react-table-kit @sanity-labs/sdk-table-kit
```

Peer dependencies for the SDK layer:

- `@sanity/icons`
- `@sanity/sdk`
- `@sanity/sdk-react`
- `@sanity/types`
- `@sanity/ui`
- `react`
- `react-dom`

You will also need `styled-components` because it is a peer dependency of
`@sanity-labs/react-table-kit`.

## Quick Start

```tsx
import {
  SanityDocumentTable,
  column,
  filter,
} from "@sanity-labs/sdk-table-kit";

const articleFilters = [
  filter.search({
    label: "Search",
    fields: ["title", { path: "author->name", label: "Author name" }],
  }),
  filter.string({
    field: "status",
    label: "Status",
    options: [
      { label: "Draft", value: "draft" },
      { label: "Published", value: "published" },
    ],
  }),
];

export function ArticlesTable() {
  return (
    <SanityDocumentTable
      documentType="article"
      pageSize={25}
      defaultSort={{ field: "_updatedAt", direction: "desc" }}
      filters={articleFilters}
      columns={[
        column.string({ field: "title", searchable: true, edit: true }),
        column.reference({
          field: "author",
          header: "Author",
          referenceType: "person",
          preview: {
            select: {
              name: "name",
              image: "image.asset",
            },
            prepare: ({ name, image }) => ({
              title: String(name ?? ""),
              media: image,
            }),
          },
        }),
        column.badge({
          field: "status",
          colorMap: {
            draft: "caution",
            published: "positive",
          },
        }),
        column.updatedAt(),
        column.openInStudio(),
      ]}
    />
  );
}
```

## Main Features

- `SanityDocumentTable` gives you an all-in-one table with data fetching, sorting, pagination,
  filter UI, bulk actions, and optional release-aware staging.
- `column` merges the base `react-table-kit` column helpers with SDK-specific helpers like
  `reference()`, `user()`, `documentStatus()`, and `tasks()`.
- `filter`, `useFilterUrlState`, and `useFilterPresets` are re-exported from
  `@sanity-labs/react-table-kit` so the same filter model works across both packages.
- `useSanityTableData()` is the lower-level SDK data adapter. `useSanityDocumentTable()` returns
  ready-to-spread `tableProps` and `paginationProps` if you want a custom layout.
- Comments, tasks, references, releases, and document-status cells are available as composable
  exports when you need something more custom than the default table.

## Most Important Exports

SDK-specific exports:

- `SanityDocumentTable`
- `column`
- `useSanityTableData()`
- `useSanityDocumentTable()`
- `PaginationControls`
- `AddonDataProvider`
- `useSDKEditHandler()`
- `ReferenceCell`
- `ReferenceEditPopover`
- `PreviewCell`
- `UserCell`
- `OpenInStudioCell`
- `DocumentStatusCell`
- `SharedCommentsPanel`
- `TaskSummaryEditorView`

Re-exported from `@sanity-labs/react-table-kit`:

- `DocumentTable`
- `filter`
- `useFilterUrlState()`
- `useFilterPresets()`
- all filter and table types exported from the shared table kit barrel

## `SanityDocumentTable` Props

The table has a larger surface area than the quick-start example shows. These are the main props
most apps reach for first:

```tsx
<SanityDocumentTable
  documentType="article"
  // String for one type, or string[] when you want to query across multiple types.

  filter='status != "archived"'
  // Optional raw GROQ predicate appended to the base type filter.

  params={{ market: "us" }}
  // Params used by the raw `filter` prop and merged with compiled filter params.

  filters={filters}
  // Explicit filter definitions rendered above the table and compiled into GROQ.

  filterState={filterState}
  // Optional shared URL-backed filter state from `useFilterUrlState(filters)`.

  columns={columns}
  // Column defs from `column.*()` or compatible `ColumnDef`s.

  pageSize={25}
  // Enables server-backed pagination for the single-document-type flow.

  pageSizeOptions={[25, 50, 100]}
  onPageSizeChange={(nextPageSize) => console.log(nextPageSize)}
  defaultSort={{ field: "_updatedAt", direction: "desc" }}
  // Default server sort when pagination is enabled.

  projection="{ _id, _type, title }"
  // Optional escape hatch when you do not want the projection generated from columns.

  emptyMessage="No articles found"
  stripedRows
  onRowClick={(row) => console.log(row)}
  bulkActions={(selection) => <MyBulkActions selection={selection} />}
  onSelectionChange={(selectedRows) => console.log(selectedRows)}
  createDocument
  // `true` uses defaults, or pass `{buttonText, initialValues}` for custom behavior.

  releases
  // Adds release-aware UI, release header state, and version-aware staging behavior.

  computedFilters={computedFilters}
  // Named filters that other UI surfaces can activate, such as stat cards.

  reorderable
  columnOrder={columnOrder}
  onColumnOrderChange={setColumnOrder}
/>
```

### Important behavior

- `documentType` accepts `string | string[]`.
- Use a single `documentType` when you want the built-in paginated document-table flow. Use
  `string[]` when you want one query-backed table across multiple document types.
- `pageSize` changes how data is loaded. In the documented single-type flow it enables SDK
  pagination; without it, the table falls back to query mode.
- When paginated mode is active, grouping is server-aware. The current group key is stored in the
  `groupBy` URL param and the SDK prefixes the active group ordering ahead of the current sort.
- `params` are merged with compiled filter params. The internal document-type params still win, so
  avoid relying on your own `docType` or `docTypes` keys.
- `columns` are not only presentation config. Their `field` values also drive the generated GROQ
  projection unless you provide `projection` yourself.
- `bulkActions` are additive. The table can still inject built-in publish and release actions when
  those features are enabled.
- `createDocument` supports either `true` or an object config for custom button text and initial
  values.
- `releases` does not filter the table or change the table read perspective. It keeps the normal
  row set visible and treats the selected release as the staging target for edits and release
  actions.

### Server-backed grouping

`SanityDocumentTable` and `useSanityDocumentTable()` automatically wire server-backed grouping for
paginated tables. Mark columns as `groupable: true`, and the table will expose them in the group-by
UI while `useSanityTableData()` keeps the active group key in URL state and injects the matching
ordering into the SDK query.

For display-oriented columns, you can separate the visible group label from the backend ordering
field:

```ts
column.custom({
  field: 'status',
  header: 'Status',
  groupable: true,
  groupValue: (rawValue) => statusLabels[String(rawValue ?? '')] ?? String(rawValue ?? ''),
  groupField: 'coalesce(status, "draft")',
})

column.reference({
  field: 'section',
  header: 'Section',
  referenceType: 'section',
  preview,
  groupable: true,
  groupField: 'section->title',
})
```

Use `groupValue` when group headers should show a prepared or friendly label. Use `groupField` when
the server should group by a different path or GROQ expression than the rendered cell value.

## `column` Helper Reference

The SDK `column` namespace contains every base helper from `@sanity-labs/react-table-kit` plus
Sanity-specific helpers.

### Shared config building blocks

Most helpers build on a common shape like this:

```ts
type CommonColumnOptions = {
  header?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  filterable?: boolean;
  groupable?: boolean;
  searchable?: boolean;
  flex?: number;
  width?: number;
};

type RoleOptions = {
  visibleTo?: string[];
  editableBy?: string[];
};

type CommentOptions =
  | true
  | {
      fieldPath?: string;
      fieldLabel?: string;
    };
```

`field` can be a simple field, a dot path, or a GROQ expression:

```ts
"title";
"web.dueDate";
'coalesce(status, "draft")';
```

The SDK layer automatically turns non-simple fields into projection aliases for rendering while
preserving the real edit path for patches.

### Base helpers from `react-table-kit`, wrapped by the SDK

#### `column.select()`

Checkbox selection column.

```ts
column.select(config?: {width?: number} & RoleOptions)
```

#### `column.string()`

Generic text column.

```ts
column.string({
  ...common,
  ...roles,
  field: string,
  sortable?: boolean,
  edit?: true | {onSave: (document, newValue: string) => void},
  comments?: CommentOptions,
})
```

If you omit `header`, the helper derives a neutral label from the field when possible
(for example `title` -> `Title`, `authorName` -> `Author Name`, `web.dueDate` -> `Due Date`).

#### `column.title()`

Deprecated compatibility preset for the common `title` field. Equivalent to
`column.string({field: 'title', header: 'Title'})`, while still allowing `field` overrides for
older call sites.

#### `column.type()`

Document type column backed by `_type`.

```ts
column.type({
  ...common,
  ...roles,
  sortable?: boolean,
  edit?: true | {options: EditOption[]; onSave: (document, newValue: string) => void},
})
```

#### `column.updatedAt()`

Last-updated column backed by `_updatedAt`.

```ts
column.updatedAt({
  ...common,
  ...roles,
  sortable?: boolean,
  edit?: true | {
    onSave: (document, newValue: string) => void
    toneByDateRange?: boolean
  },
})
```

#### `column.custom()`

Advanced escape hatch for columns that need computed projections or custom rendering, sorting,
grouping, filtering, or editing behavior.

```ts
column.custom({
  field: string,
  ...advancedOptions,
})
```

Prefer `column.string()`, `column.badge()`, `column.date()`, or `column.reference()` when they fit
the data shape. See `Advanced: column.custom()` below for the full prop reference and example.

#### `column.badge()`

Badge-rendered categorical column.

```ts
column.badge({
  ...common,
  ...roles,
  field: string,
  colorMap?: Record<string, BadgeTone | {tone: BadgeTone; label: string}>,
  sortable?: boolean,
  edit?: true | {options: EditOption[]; onSave: (document, newValue: string) => void},
})
```

#### `column.date()`

Date column with optional overdue or date-range tone behavior.

```ts
column.date({
  ...common,
  ...roles,
  field: string,
  sortable?: boolean,
  showOverdue?: boolean,
  toneByDateRange?: boolean,
  edit?: true | {
    onSave: (document, newValue: string) => void
    toneByDateRange?: boolean
  },
  filterMode?: 'exact' | 'range',
  comments?: CommentOptions,
})
```

#### `column.boolean()`

Boolean column rendered as a toggle/checkbox style cell.

```ts
column.boolean({
  ...common,
  ...roles,
  field: string,
  sortable?: boolean,
  edit?: true | {onSave: (document, newValue: boolean) => void},
})
```

### SDK-only helpers

#### `column.openInStudio()`

Action column that opens the current row in Sanity Studio.

```ts
column.openInStudio(config?: {width?: number; header?: string})
```

#### `column.reference()`

Reference column with Sanity Studio-style preview config and optional inline editing.

```ts
column.reference({
  field: string,
  header: string,
  referenceType: string,
  preview: {
    select: Record<string, string>,
    prepare: (selection) => ({
      title?: string,
      subtitle?: string,
      media?: unknown,
    }),
  },
  sortable?: boolean,
  sortField?: string,
  filterable?: boolean,
  groupable?: boolean,
  groupField?: string,
  width?: number,
  edit?: boolean,
  placeholder?: string,
  comments?: CommentOptions,
})
```

Use `sortField` when the server should sort by a different field than the rendered preview title.
Use `groupField` when server-backed grouping should use a different path or expression than the
prepared preview title.

#### `column.preview()`

Document preview cell powered by the SDK preview APIs.

```ts
column.preview(config?: {header?: string; width?: number})
```

#### `column.user()`

Resolves a stored user ID into an avatar/name cell.

```ts
column.user({
  field: string,
  header: string,
  showName?: boolean | 'first',
  width?: number,
  comments?: CommentOptions,
})
```

#### `column.documentStatus()`

Publish-state cell that matches Studio document status semantics.

```ts
column.documentStatus(config?: {width?: number; header?: string})
```

#### `column.tasks()`

Task summary cell for document-scoped tasks.

```ts
column.tasks(config?: {header?: string; width?: number})
```

## Advanced: `column.custom()`

Use `column.custom()` when a built-in helper does not model the column cleanly.

Reach for it when:

- the rendered value comes from a computed GROQ projection
- the cell needs custom JSX
- sorting should compare a derived label rather than the raw value
- group headers should show a friendly label
- server-backed grouping should use a different backend field or GROQ expression
- filtering needs a custom predicate
- editing needs the full `ColumnEditConfig` surface

Prefer a built-in helper when:

- the value is plain text and maps cleanly to one field: `column.string()`
- the value is categorical and should render as a badge: `column.badge()`
- the value is a date or datetime: `column.date()`
- the value is a Sanity reference preview: `column.reference()`

### Full config surface

```ts
column.custom({
  // identity and data
  field: string,
  projection?: string,

  // presentation
  header?: string,
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>,
  filterable?: boolean,
  groupable?: boolean,
  searchable?: boolean,
  flex?: number,
  width?: number,

  // rendering and table behavior
  cell?: (value, row) => React.ReactNode,
  sortable?: boolean,
  sortValue?: (rawValue, row) => string | number,
  groupValue?: (rawValue, row) => string,
  groupField?: string,
  filterFn?: (row, filterValue) => boolean,
  filterMode?: 'exact' | 'range',

  // editing, access, and comments
  edit?: ColumnEditConfig,
  visibleTo?: string[],
  editableBy?: string[],
  comments?: CommentOptions,
})
```

### What each prop is for

Identity and data:

- `field` is required. It gives the column a stable key and names the row value used by the cell.
  When you also provide `projection`, `field` is usually a simple alias such as `workflowStage` or
  `enteredStageAt`.
- `projection` is SDK-only. Use it when the rendered value should come from a custom GROQ
  expression instead of reading directly from `field`.

Presentation:

- `header`, `icon`, `flex`, and `width` control how the column is labeled and laid out.
- `filterable`, `groupable`, and `searchable` decide whether the column participates in those table
  features.

Rendering and table behavior:

- `cell` renders the value with custom JSX.
- `sortable` enables or disables sorting for the column.
- `sortValue` transforms the raw value before sorting. Use it when the visible label differs from
  the stored value.
- `groupValue` transforms the raw value into the visible group label.
- `groupField` is the backend field or GROQ expression to use for server-backed grouping when that
  should differ from the rendered cell value.
- `filterFn` lets you provide a custom client-side predicate for the column.
- `filterMode` chooses how built-in filtering should interpret values: exact match or range.

Editing, access, and comments:

- `edit` accepts the full `ColumnEditConfig`, so `column.custom()` can opt into `text`, `select`,
  `date`, or fully custom editing flows.
- `visibleTo` limits which role slugs can see the column.
- `editableBy` limits which role slugs can edit the column.
- `comments` enables field-scoped comments. Use `true` for the default field path and label, or an
  object to override `fieldPath` and `fieldLabel`.

### Example: computed workflow stage column

```tsx
import {Badge} from '@sanity/ui'
import {column} from '@sanity-labs/sdk-table-kit'

const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft & Edit',
  ideation: 'Ideation',
  scheduled: 'Scheduled',
}

export const workflowStageColumn = column.custom({
  field: 'workflowStage',
  header: 'Workflow stage',
  projection: 'coalesce(status, "draft")',
  groupable: true,
  filterable: true,
  searchable: true,
  cell: (value) => {
    const stage = String(value ?? 'draft')
    return <Badge tone={stage === 'scheduled' ? 'positive' : 'primary'}>{STAGE_LABELS[stage]}</Badge>
  },
  sortValue: (rawValue) => STAGE_LABELS[String(rawValue ?? 'draft')] ?? 'Draft & Edit',
  groupValue: (rawValue) => STAGE_LABELS[String(rawValue ?? 'draft')] ?? 'Draft & Edit',
  groupField: 'coalesce(status, "draft")',
})
```

Why this uses `column.custom()`:

- `field` is a stable alias for a computed value rather than a real document field.
- `projection` fetches that computed value from GROQ.
- `cell` renders the value as a badge instead of plain text.
- `sortValue` and `groupValue` keep sorting and group labels aligned with the displayed stage label.
- `groupField` tells server-backed grouping which backend expression to use.

## How Filters Work

`sdk-table-kit` re-exports the filter model from `@sanity-labs/react-table-kit`, then compiles the
active filter values into GROQ before calling the SDK.

### Step 1: define filters

Most apps start with these builders:

```ts
filter.string({
  field: 'status',
  label: 'Status',
  operator?: 'is' | 'in',
  options?: Array<{label: string; value: string}>,
})

filter.date({
  field: 'plannedPublishDate',
  label: 'Planned publish date',
  operator?: 'is' | 'before' | 'after' | 'range',
  granularity?: 'date' | 'datetime',
  includeTime?: boolean,
})

filter.number({
  field: 'priority',
  label: 'Priority',
  operator?: 'is' | 'gt' | 'gte' | 'lt' | 'lte' | 'range',
  options?: Array<{label: string; value: number}>,
})

filter.boolean({
  field: 'featured',
  label: 'Featured',
})

filter.reference({
  field: 'author',
  label: 'Author',
  referenceType: 'person',
  relation?: 'single' | 'array',
  preview?: {
    select: Record<string, string>,
    prepare: (selection) => PreviewValue,
  },
  options?: {
    source?: 'documents',
    searchable?: boolean,
    pageSize?: number,
    filter?: string,
    params?: Record<string, unknown>,
    sort?: {field: string; direction: 'asc' | 'desc'},
  },
})

filter.search({
  label: 'Search',
  fields: ['title', {path: 'author->name', label: 'Author name'}],
  mode?: 'contains' | 'match',
  placeholder?: string,
  debounceMs?: number,
})

filter.custom({
  key: 'myFilter',
  label: 'My filter',
  control: 'select',
  valueType: 'string',
  serialize: (value) => value,
  deserialize: (value) => value,
  formatChip: (value) => String(value),
  component?: (props) => React.ReactNode,
  clientPredicate?: (row, value) => boolean,
  query?: {
    toGroq: (value, context) => ({groq: '...', params: {...}}),
    toCountGroq?: (value, context) => ({groq: '...', params: {...}}),
  },
})
```

All filter builders share the same base metadata:

```ts
{
  key?: string
  label: string
  operator?: ...
  defaultValue?: ...
  hidden?: boolean
  toInitialValue?: (value) => unknown
}
```

`filter.search()` fields are source query paths, not projected row aliases, so paths like
`author->name` or `section->title` are valid.

### Step 2: store shared URL-backed state

```tsx
import { filter, useFilterUrlState } from "@sanity-labs/sdk-table-kit";

const filters = [
  filter.search({ label: "Search", fields: ["title"] }),
  filter.string({ field: "status", label: "Status" }),
];

const filterState = useFilterUrlState(filters);
```

Pass `filterState` when another surface should share the same filter source of truth. If you omit
it, `SanityDocumentTable` creates an internal URL-backed state for the same filter definitions.

`useFilterPresets()` is useful when stat cards or shortcut buttons should write named filter values
into that shared state.

### Step 3: hand filters to the table

```tsx
<SanityDocumentTable
  documentType="article"
  filters={filters}
  filterState={filterState}
  columns={columns}
/>
```

### Step 4: the table compiles filters into GROQ

Internally, the table:

1. reads the current committed values from `filterState`
2. runs `compileFilters(filters, {documentType, values, params})`
3. produces a GROQ fragment plus GROQ params for every active filter
4. merges that compiled fragment with the low-level `filter` prop
5. sends the final query to `usePaginatedDocuments()` or `useQuery()`

At a high level, the built-in filter kinds compile like this:

- string: equality or `in` checks
- boolean: equality checks
- number: equality, comparison, or range checks
- date: `dateTime(...)` comparisons or ranges
- reference: `_ref` checks for single references, or array-reference predicates when
  `relation: 'array'`
- search: `match` queries across one or more fields
- custom: whatever your `query.toGroq()` function returns

### `filters` vs `filter`

These two props are related, but they are not the same:

- `filters` is the high-level filter UI contract. The table renders controls for these and compiles
  their active values into GROQ.
- `filter` is the low-level raw GROQ predicate string.

If you pass both, the table combines them with `&&`.

## Addons, Comments, and Tasks

If you use task or comment surfaces, wrap the relevant part of your app with `AddonDataProvider`.

### `AddonDataProvider` and seeded users

Pass `users={SanityUser[]}` when your app shell already has the project members loaded:

```tsx
<AddonDataProvider users={usersFromAppShell}>
  <SanityDocumentTable {...props} />
</AddonDataProvider>
```

That prevents task popovers from needing to suspend while resolving users internally. Omitting
`users` still works, but task/comment UI may show a loading state until users resolve.

## Composable Hooks

Use the lower-level APIs when you want a custom layout:

- `useSanityTableData()` gives you raw `data`, `loading`, `pagination`, and `sorting`.
- `useSanityTableData()` also exposes `grouping` so custom layouts can keep the group-by UI in sync
  with the server-backed query state.
- `useSanityDocumentTable()` gives you ready-to-spread `tableProps` for `DocumentTable` and
  `paginationProps` for `PaginationControls`.

## Local Development

```bash
pnpm install
```

## Scripts

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
