# @sanity-labs/sdk-table-kit

## 0.2.0

### Minor Changes

- 4eebee8: Expose a generic `column.string()` helper that supports SDK role visibility, comment metadata, and auto-save integration for arbitrary string fields.

  `column.title()` is now deprecated as a compatibility preset, allowing existing tables to keep working while documentation and new examples move to the generic string helper.

- 4eebee8: Add a Studio-style global perspective picker to release-enabled tables and support published, drafts, and release perspectives directly in the table chrome.

  This release also adds published read-only handling, perspective-aware filter bar tones, and edited-field indicators that compare projected values against published content while preserving comment affordances.

## 0.1.0

### Minor Changes

- d8fc884: Export `TaskSummaryEditorView` and `TaskSummaryEditorViewProps` from the package root so
  consumers can render the task editor view outside the built-in `column.tasks()` popover.
  This makes it easier to embed the task detail UI inside modals, drawers, or other host
  surfaces that are not table cells.
