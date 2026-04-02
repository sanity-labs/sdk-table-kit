import type {PreviewConfig, PreviewValue} from '@sanity/types'
import {Button, Card} from '@sanity/ui'
import React, {Suspense, useState, useEffect, useCallback, useRef} from 'react'

import {
  CachedReferenceDocumentPickerList,
  InitialSkeleton,
  ReferenceDocumentPickerList,
} from './ReferenceDocumentPickerList'

interface ReferenceEditPopoverProps {
  value: {_type: 'reference'; _ref: string} | null
  referenceType: string
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  onSave: (newValue: {_type: 'reference'; _ref: string} | null) => void
  onClose: () => void
  onOptimisticUpdate?: (prepared: PreviewValue | null) => void
}

/**
 * Edit popover for reference columns.
 *
 * Architecture:
 *   ReferenceEditPopover (search input + cached documents ref)
 *     └─ Suspense fallback={CachedDocumentList OR InitialSkeleton}
 *          └─ DocumentList (useDeferredValue + useDocuments)
 *               └─ per-option Suspense (useDocumentProjection)
 *
 * When useDocuments suspends on search change, the Suspense fallback
 * renders the CACHED previous results (dimmed + spinner overlay) instead
 * of a blank skeleton. First load shows shimmer skeletons since there's
 * no cache yet.
 */
export function ReferenceEditPopover({
  value,
  referenceType,
  preview,
  onSave,
  onClose,
  onOptimisticUpdate,
}: ReferenceEditPopoverProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cache of last successfully loaded documents — survives Suspense unmount
  const cachedDocumentsRef = useRef<
    Array<{
      documentId: string
      documentType: string
      projectId?: string
      dataset?: string
      perspectiveStack?: string[]
    }>
  >([])

  const handleDocumentsLoaded = useCallback(
    (
      docs: Array<{
        dataset?: string
        documentId: string
        documentType: string
        perspectiveStack?: string[]
        projectId?: string
      }>,
    ) => {
      cachedDocumentsRef.current = docs
    },
    [],
  )

  useEffect(() => {
    if (!query) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  const handleSelect = useCallback(
    (docId: string, prepared?: PreviewValue) => {
      onSave({_type: 'reference', _ref: docId})
      if (onOptimisticUpdate && prepared) onOptimisticUpdate(prepared)
      onClose()
    },
    [onSave, onClose, onOptimisticUpdate],
  )

  const handleClear = useCallback(() => {
    onSave(null)
    onClose()
  }, [onSave, onClose])

  // Suspense fallback: show cached results if available, skeleton if not
  const suspenseFallback =
    cachedDocumentsRef.current.length > 0 ? (
      <CachedReferenceDocumentPickerList
        documents={cachedDocumentsRef.current}
        onSelect={handleSelect}
        preview={preview}
        value={value}
      />
    ) : (
      <InitialSkeleton />
    )

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'var(--card-bg-color, white)',
        border: '1px solid var(--card-border-color, #e3e4e8)',
        borderRadius: '4px',
        minWidth: 240,
        maxWidth: 360,
        boxShadow:
          '0 2px 8px var(--card-shadow-umbra-color, rgba(0,0,0,0.08)), 0 4px 16px var(--card-shadow-penumbra-color, rgba(0,0,0,0.04))',
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
      <div style={{padding: '8px', borderBottom: '1px solid var(--card-border-color, #e3e4e8)'}}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Type to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid var(--card-focus-ring-color, #2276fc)',
            borderRadius: '3px',
            outline: '1px solid var(--card-focus-ring-color, #2276fc)',
            outlineOffset: '-1px',
            boxSizing: 'border-box',
            fontSize: '13px',
            background: 'var(--card-bg-color, white)',
            color: 'var(--card-fg-color)',
          }}
        />
      </div>

      <div role="listbox" style={{maxHeight: '240px', overflowY: 'auto'}}>
        <Suspense fallback={suspenseFallback}>
          <ReferenceDocumentPickerList
            onDocumentsLoaded={handleDocumentsLoaded}
            onSelect={handleSelect}
            preview={preview}
            referenceType={referenceType}
            searchQuery={debouncedQuery}
            value={value}
          />
        </Suspense>
      </div>

      {value && (
        <Card
          padding={2}
          borderTop
          style={{borderTop: '1px solid var(--card-border-color, #e3e4e8)'}}
        >
          <Button
            tone="critical"
            onClick={handleClear}
            mode="ghost"
            aria-label="Clear reference"
            text="Clear Reference"
            style={{width: '100%'}}
          />
        </Card>
      )}
    </div>
  )
}
