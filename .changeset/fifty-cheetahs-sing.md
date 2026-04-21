---
'@sanity-labs/sdk-table-kit': patch
---

Prevent release bulk actions from crashing when no Sanity UI `ToastProvider` is mounted by using
safe toast handling in the release UI components.
