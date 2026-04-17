---
"@sanity-labs/sdk-table-kit": minor
---

Export `TaskSummaryEditorView` and `TaskSummaryEditorViewProps` from the package root so
consumers can render the task editor view outside the built-in `column.tasks()` popover.
This makes it easier to embed the task detail UI inside modals, drawers, or other host
surfaces that are not table cells.
