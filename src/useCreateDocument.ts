import {useCallback, useRef, useState} from 'react'
import {useApplyDocumentActions} from '@sanity/sdk-react'
import {createDocument} from '@sanity/sdk'
import {useOptionalReleaseContext} from './ReleaseContext'
import {useSafeToast} from './useSafeToast'

export interface CreateDocumentConfig {
  /** Initial field values for new documents. */
  initialValues?: Record<string, unknown>
  /** Custom button text. Defaults to "Add {documentType}". */
  buttonText?: string
}

export interface FilterState {
  [key: string]: unknown
}

export interface UseCreateDocumentOptions {
  /** The document type to create. */
  documentType: string
  /** Initial values from consumer config. */
  initialValues?: Record<string, unknown>
  /** Active filter state — values are merged into new documents (takes precedence over initialValues). */
  activeFilters?: FilterState
}

export interface UseCreateDocumentResult {
  /** Create a new document. No-op if already creating. */
  create: () => Promise<void>
  /** Whether a creation is currently in flight. */
  isCreating: boolean
  /** Call this to reset the creating state. Used by the table to defer reset until the new row appears. */
  resetCreating: () => void
}

/** Safety timeout duration (10 seconds) to prevent spinner from getting stuck forever. */
const SAFETY_TIMEOUT_MS = 10_000

export function useCreateDocument(options: UseCreateDocumentOptions): UseCreateDocumentResult {
  const {documentType, initialValues, activeFilters} = options
  const apply = useApplyDocumentActions()
  const releaseCtx = useOptionalReleaseContext()
  const toast = useSafeToast()
  const [isCreating, setIsCreating] = useState(false)
  const isCreatingRef = useRef(false)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetCreating = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = null
    }
    isCreatingRef.current = false
    setIsCreating(false)
  }, [])

  const create = useCallback(async () => {
    // Debounce: no-op if already creating
    if (isCreatingRef.current) return

    isCreatingRef.current = true
    setIsCreating(true)

    // Merge initial values: config defaults + filter overrides
    const mergedValues: Record<string, unknown> = {}
    if (initialValues) {
      Object.assign(mergedValues, initialValues)
    }
    if (activeFilters) {
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value !== undefined) {
          mergedValues[key] = value
        }
      }
    }

    try {
      const action = createDocument(
        {documentType},
        Object.keys(mergedValues).length > 0 ? mergedValues : undefined,
      )
      await apply(action)
      // SUCCESS: don't reset — consumer calls resetCreating() when new row appears.
      // Start safety timeout so spinner doesn't get stuck forever.
      safetyTimeoutRef.current = setTimeout(() => {
        isCreatingRef.current = false
        setIsCreating(false)
      }, SAFETY_TIMEOUT_MS)
    } catch (error) {
      // ERROR: reset immediately so user can retry
      isCreatingRef.current = false
      setIsCreating(false)
      toast.push({
        status: 'error',
        title: "Couldn't create document. Please try again.",
        closable: true,
        duration: 5000,
      })
      throw error
    }
  }, [documentType, initialValues, activeFilters, apply, toast])

  return {create, isCreating, resetCreating}
}
