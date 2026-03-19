import {useToast} from '@sanity/ui'

interface SafeToast {
  push: (params: {
    status: 'error' | 'warning' | 'success' | 'info'
    title: string
    closable?: boolean
    duration?: number
  }) => void
}

const noopToast: SafeToast = {push: () => {}}

/**
 * A safe wrapper around `useToast` from `@sanity/ui`.
 *
 * Returns a no-op toast when no `ToastProvider` is present in the tree,
 * instead of throwing. This allows hooks to push toasts without requiring
 * consumers to always wrap in a `ToastProvider`.
 */
export function useSafeToast(): SafeToast {
  try {
    // useToast internally calls useContext (always runs), then throws
    // if the context value is null. We catch that throw.
    return useToast()
  } catch {
    return noopToast
  }
}
