import React, {Suspense, useState, useDeferredValue, useEffect, useCallback, useRef} from 'react'
import {useDocuments, useDocumentProjection} from '@sanity/sdk-react'
import type {DocumentHandle} from '@sanity/sdk'
import type {PreviewConfig, PreviewValue} from '@sanity/types'
import {Box, Button, Card, Flex, Spinner, Text} from '@sanity/ui'

/** Shimmer skeleton for a loading option row */
function OptionSkeleton() {
  return (
    <div
      style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          background: 'var(--card-skeleton-from, #e3e4e8)',
          flexShrink: 0,
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: 14,
          borderRadius: '3px',
          background: 'var(--card-skeleton-from, #e3e4e8)',
          flex: 1,
          maxWidth: 180,
          animation: 'shimmer 1.5s ease-in-out infinite',
          animationDelay: '0.1s',
        }}
      />
    </div>
  )
}

interface ReferenceEditPopoverProps {
  value: {_type: 'reference'; _ref: string} | null
  referenceType: string
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  onSave: (newValue: {_type: 'reference'; _ref: string} | null) => void
  onClose: () => void
  onOptimisticUpdate?: (prepared: PreviewValue | null) => void
}

function buildProjectionString(select: Record<string, string>): string {
  const parts: string[] = []
  for (const [key, path] of Object.entries(select)) {
    if (path === key && !path.includes('.') && !path.includes('[')) {
      parts.push(key)
    } else {
      parts.push(`"${key}": ${path}`)
    }
  }
  return `{${parts.join(', ')}}`
}

/** Single option — resolves document data via useDocumentProjection */
function ReferenceOption({
  handle,
  preview,
  projectionString,
  isSelected,
  onClick,
}: {
  handle: DocumentHandle
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  projectionString: string
  isSelected: boolean
  onClick: (id: string, prepared?: PreviewValue) => void
}) {
  const {data, isPending} = useDocumentProjection<Record<string, unknown>>({
    ...handle,
    projection: projectionString as `{${string}}`,
  })

  if (isPending) {
    return <OptionSkeleton />
  }

  let prepared: PreviewValue
  try {
    const raw = (preview.prepare as (data: Record<string, unknown>) => PreviewValue)(
      (data as Record<string, unknown>) || {},
    )
    prepared = {
      ...raw,
      title: raw.title || handle.documentId || 'Untitled',
    }
  } catch {
    prepared = {title: handle.documentId || 'Untitled'}
  }

  const imgUrl =
    prepared.imageUrl ?? (typeof prepared.media === 'string' ? (prepared.media as string) : null)
  const title = prepared.title || 'Untitled'
  const initial = title.charAt(0).toUpperCase()

  return (
    <Card
      as="div"
      role="option"
      aria-selected={isSelected}
      onClick={() => onClick(handle.documentId, prepared)}
      padding={2}
      radius={0}
      tone="default"
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid var(--card-border-color, #e3e4e8)',
      }}
    >
      <Button padding={2} radius={0} tone="neutral" muted mode="bleed" style={{width: '100%'}}>
        <Flex gap={2} align="center">
          <Box
            style={{
              width: 32,
              height: 32,
              background: imgUrl ? 'transparent' : 'var(--card-badge-default-bg-color, #e3e4e8)',
              color: 'var(--card-badge-default-fg-color, #515e72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 600,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={title}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            ) : (
              initial
            )}
          </Box>
          <Flex direction="column" gap={2} style={{minWidth: 0}}>
            <Text size={1} textOverflow="ellipsis">
              {title}
            </Text>
            {prepared.subtitle && (
              <Text size={1} muted textOverflow="ellipsis">
                {prepared.subtitle}
              </Text>
            )}
          </Flex>
        </Flex>
      </Button>
    </Card>
  )
}

/**
 * Inner component that calls useDocuments. Reports loaded documents
 * to parent via onDocumentsLoaded callback for caching.
 */
function DocumentList({
  referenceType,
  searchQuery,
  preview,
  value,
  onSelect,
  onDocumentsLoaded,
}: {
  referenceType: string
  searchQuery: string
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  value: {_type: 'reference'; _ref: string} | null
  onSelect: (docId: string, prepared?: PreviewValue) => void
  onDocumentsLoaded: (docs: DocumentHandle[]) => void
}) {
  const deferredQuery = useDeferredValue(searchQuery)
  const isStale = deferredQuery !== searchQuery

  const {data: documents, isPending} = useDocuments({
    documentType: referenceType,
    ...(deferredQuery ? {search: deferredQuery} : {}),
  })

  // Report documents to parent for caching (used when Suspense shows fallback)
  // Use a ref to avoid triggering re-renders from the callback
  const lastReportedRef = useRef<string>('')
  const docIds = documents?.map((d) => d.documentId).join(',') ?? ''
  if (documents && documents.length > 0 && docIds !== lastReportedRef.current) {
    lastReportedRef.current = docIds
    onDocumentsLoaded(documents)
  }

  const projectionString = buildProjectionString(preview.select)

  if (!documents || documents.length === 0) {
    if (isPending || isStale) {
      return (
        <div style={{padding: '12px', display: 'flex', justifyContent: 'center'}}>
          <Spinner muted />
        </div>
      )
    }
    return (
      <div style={{padding: '12px', textAlign: 'center', color: 'var(--card-muted-fg-color)'}}>
        No results
      </div>
    )
  }

  return (
    <div style={{opacity: isPending || isStale ? 0.5 : 1, transition: 'opacity 150ms ease'}}>
      {documents.map((handle: DocumentHandle) => (
        <Suspense key={handle.documentId} fallback={<OptionSkeleton />}>
          <ReferenceOption
            handle={handle}
            preview={preview}
            projectionString={projectionString}
            isSelected={value?._ref === handle.documentId}
            onClick={onSelect}
          />
        </Suspense>
      ))}
    </div>
  )
}

/**
 * Cached fallback — renders the last known documents while Suspense
 * is showing (useDocuments suspended on search change). Shows old
 * results at 50% opacity with a spinner overlay.
 */
function CachedDocumentList({
  documents,
  preview,
  value,
  onSelect,
}: {
  documents: DocumentHandle[]
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  value: {_type: 'reference'; _ref: string} | null
  onSelect: (docId: string, prepared?: PreviewValue) => void
}) {
  const projectionString = buildProjectionString(preview.select)

  return (
    <div style={{opacity: 0.5, transition: 'opacity 150ms ease', position: 'relative'}}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Spinner muted />
      </div>
      {documents.map((handle) => (
        <Suspense key={handle.documentId} fallback={<OptionSkeleton />}>
          <ReferenceOption
            handle={handle}
            preview={preview}
            projectionString={projectionString}
            isSelected={value?._ref === handle.documentId}
            onClick={onSelect}
          />
        </Suspense>
      ))}
    </div>
  )
}

/**
 * Initial loading skeleton (no cached data available yet)
 */
function InitialSkeleton() {
  return (
    <div style={{padding: '8px'}}>
      <OptionSkeleton />
      <OptionSkeleton />
      <OptionSkeleton />
    </div>
  )
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
  const cachedDocumentsRef = useRef<DocumentHandle[]>([])

  const handleDocumentsLoaded = useCallback((docs: DocumentHandle[]) => {
    cachedDocumentsRef.current = docs
  }, [])

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
      <CachedDocumentList
        documents={cachedDocumentsRef.current}
        preview={preview}
        value={value}
        onSelect={handleSelect}
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
          <DocumentList
            referenceType={referenceType}
            searchQuery={debouncedQuery}
            preview={preview}
            value={value}
            onSelect={handleSelect}
            onDocumentsLoaded={handleDocumentsLoaded}
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
