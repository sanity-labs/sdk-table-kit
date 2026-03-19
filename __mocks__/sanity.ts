/**
 * Auto-mock for 'sanity' package.
 * Tests that need specific behavior should override with vi.mock('sanity', ...)
 * This stub prevents 'Failed to resolve import' errors since sanity
 * is a peer dep not installed in dev.
 */
import {vi} from 'vitest'

export const DocumentStatusIndicator = vi.fn(() => null)
export const useDocumentVersionInfo = vi.fn(() => ({
  draft: null,
  published: null,
  versions: [],
}))
export const usePerspective = vi.fn(() => ({}))
