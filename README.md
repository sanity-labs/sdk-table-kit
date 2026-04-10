# `@sanity-labs/sdk-table-kit`

Sanity SDK integration layer for `@sanity-labs/react-table-kit`.

This package adds SDK-backed data fetching, document actions, release-aware UI,
comments/tasks integrations, and Sanity-specific column helpers on top of the
base React table primitives.

## Installation

```bash
pnpm add @sanity-labs/react-table-kit @sanity-labs/sdk-table-kit
```

## Local Development

Until `@sanity-labs/react-table-kit` is published to npm, local development expects
the sibling repo checkout at `../react-table-kit`.

```bash
cd ../react-table-kit
pnpm install
pnpm build

cd ../sdk-table-kit
pnpm install
```

If you change `react-table-kit`, rebuild it and rerun `pnpm install` here so the
file dependency snapshot is refreshed.

Peer dependencies:

- `@sanity/icons`
- `@sanity/sdk`
- `@sanity/sdk-react`
- `@sanity/types`
- `@sanity/ui`
- `react`
- `react-dom`

Optional feature dependencies used by the bundled comments/tasks helpers:

- `@sanity-labs/sdk-addon-dataset-runtime`
- `@sanity-labs/sdk-comments`
- `@sanity-labs/sdk-tasks`

## Quick Start

```tsx
import {SanityDocumentTable, column} from '@sanity-labs/sdk-table-kit'

export function ArticlesTable() {
  return (
    <SanityDocumentTable
      documentType="article"
      columns={[
        column.title({field: 'title', edit: true}),
        column.updatedAt(),
      ]}
    />
  )
}
```

## Primary Exports

- `SanityDocumentTable`
- `column`
- `useSanityTableData()`
- `useSanityDocumentTable()`
- `useSDKEditHandler()`
- `ReferenceCell`
- `DocumentStatusCell`
- `CommentableCell`
- `SharedCommentsPanel`
- `useAddonComments()`
- `useAddonTasks()`

### Tasks popover and `AddonDataProvider`

Wrap your table with [`AddonDataProvider`](./src/context/AddonDataContext.tsx) so tasks sync from the addon dataset. Pass **`users={SanityUser[]}`** when your shell already has project members (e.g. from app load). That value is forwarded on context; the task list and popover then use **seeded users** and do not fall back to `useUsers()` inside the popover (which would suspend the task UI behind React `Suspense`). Omitting `users` still works but may show a generic loading state until users resolve.

## Relationship To `react-table-kit`

- Use `@sanity-labs/react-table-kit` for UI-first, data-source-agnostic table primitives.
- Use `@sanity-labs/sdk-table-kit` when your app already uses `@sanity/sdk-react`
  and you want Sanity-aware data loading and actions.

## Scripts

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
