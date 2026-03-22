import type {ToastContextValue} from '@sanity/ui'
import {createContext, useContext, type Context} from 'react'
/** Ensures Sanity UI registers its global-scoped ToastContext (browser). */
import '@sanity/ui'

interface SafeToast {
  push: (params: {
    status: 'error' | 'warning' | 'success' | 'info'
    title: string
    closable?: boolean
    duration?: number
  }) => void
}

const noopToast: SafeToast = {push: () => {}}

const TOAST_CONTEXT_KEY = '@sanity/ui/context/toast'
const TOAST_SYMBOL = Symbol.for(TOAST_CONTEXT_KEY)

let ssrFallbackContext: Context<ToastContextValue | null> | undefined

function getToastContext(): Context<ToastContextValue | null> {
  if (typeof document === 'undefined') {
    if (!ssrFallbackContext) {
      ssrFallbackContext = createContext<ToastContextValue | null>(null)
    }
    return ssrFallbackContext
  }
  const scope = globalThis as Record<symbol, Context<ToastContextValue | null> | undefined>
  const existing = scope[TOAST_SYMBOL]
  if (existing) {
    return existing
  }
  if (!ssrFallbackContext) {
    ssrFallbackContext = createContext<ToastContextValue | null>(null)
  }
  return ssrFallbackContext
}

function isCompatibleToast(value: unknown): value is ToastContextValue {
  if (typeof value !== 'object' || value === null) return false
  const v = value as {version?: unknown; push?: unknown}
  return v.version === 0 && typeof v.push === 'function'
}

/**
 * A safe wrapper around `useToast` from `@sanity/ui`.
 *
 * Returns a no-op toast when no `ToastProvider` is present in the tree,
 * instead of throwing. This allows hooks to push toasts without requiring
 * consumers to always wrap in a `ToastProvider`.
 *
 * Uses the same global-scoped React context as `@sanity/ui` (see
 * `createGlobalScopedContext` in `@sanity/ui`), so behavior matches `useToast`
 * when a provider is present.
 */
export function useSafeToast(): SafeToast {
  const ToastContext = getToastContext()
  const value = useContext(ToastContext)
  if (!isCompatibleToast(value)) {
    return noopToast
  }
  return value
}
