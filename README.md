# `@sanity-labs/sdk-table-kit`

SDK-native document tables for Sanity apps built on `@sanity/sdk-react`.

![Screenshot of the App](./docs/media/table-kit-main-screenshot.avif)

This package sits on top of `@sanity-labs/react-table-kit` and adds:

- Sanity SDK-backed data fetching and pagination
- automatic GROQ projection generation from your columns
- explicit filter definitions with URL-backed state
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

Escape hatch for custom rendering, sorting, filtering, and SDK projection control.

```ts
column.custom({
  ...common,
  ...roles,
  field: string,
  cell?: (value, row) => React.ReactNode,
  sortable?: boolean,
  sortValue?: (rawValue, row) => string | number,
  edit?: ColumnEditConfig,
  filterFn?: (row, filterValue) => boolean,
  filterMode?: 'exact' | 'range',
  projection?: string,
  comments?: CommentOptions,
})
```

Use `projection` when the rendered value should come from a custom GROQ expression instead of the
column `field`.

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
  width?: number,
  edit?: boolean,
  placeholder?: string,
  comments?: CommentOptions,
})
```

Use `sortField` when the server should sort by a different field than the rendered preview title.

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
