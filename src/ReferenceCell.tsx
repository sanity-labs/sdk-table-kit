import type {DocumentBase} from '@sanetti/sanity-table-kit'
import {AddIcon} from '@sanity/icons'
import type {PreviewValue} from '@sanity/types'
import {Box, Button, Card, Flex, Popover, Spinner, Text} from '@sanity/ui'
import React, {useState, useCallback, useEffect, memo, Suspense} from 'react'

import {ReferenceEditPopover} from './ReferenceEditPopover'

interface EditMeta {
  onSave: (row: DocumentBase, newValue: {_type: 'reference'; _ref: string} | null) => void
  referenceType: string
  preview: {
    select: Record<string, string>
    prepare: (data: Record<string, unknown>) => PreviewValue
  }
  rawRefValue: {_type: 'reference'; _ref: string} | null
  placeholder?: string
}

interface ReferenceCellProps {
  value: unknown
  row: DocumentBase
  prepare: (data: Record<string, unknown>) => PreviewValue
  selectKeys: string[]
  editMeta?: EditMeta
}

/**
 * Custom memo comparator for ReferenceCell.
 *
 * The editMeta object is recreated on every cell render (inside useResolvedColumns),
 * so shallow equality always fails. Instead, compare the stable parts:
 * - referenceType (string, stable per column)
 * - rawRefValue._ref (changes when the actual reference changes)
 * - placeholder (string, stable per column)
 *
 * The onSave/preview functions are recreated but functionally identical
 * (they close over the same apply() and preview config).
 */
function referenceCellAreEqual(prev: ReferenceCellProps, next: ReferenceCellProps): boolean {
  // Value changed — must re-render
  if (prev.value !== next.value) return false
  // Row identity changed
  if (prev.row._id !== next.row._id) return false
  // Row data changed (e.g., _updatedAt)
  if (prev.row._updatedAt !== next.row._updatedAt) return false
  // editMeta presence changed
  if (!!prev.editMeta !== !!next.editMeta) return false
  // editMeta stable parts changed
  if (prev.editMeta && next.editMeta) {
    if (prev.editMeta.referenceType !== next.editMeta.referenceType) return false
    if (prev.editMeta.rawRefValue?._ref !== next.editMeta.rawRefValue?._ref) return false
    if (prev.editMeta.placeholder !== next.editMeta.placeholder) return false
  }
  return true
}

export const ReferenceCell = memo(function ReferenceCell({
  value,
  row,
  prepare,
  selectKeys: _selectKeys,
  editMeta,
}: ReferenceCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [optimisticValue, setOptimisticValue] = useState<PreviewValue | null>(null)

  const isEmpty =
    value == null || (typeof value === 'object' && value !== null && isEmptyRef(value))
  const hasOptimistic = optimisticValue !== null

  // When server data updates (value changes), clear optimistic state
  useEffect(() => {
    if (optimisticValue !== null) {
      setOptimisticValue(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, row._id])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (editMeta && !isEditing) {
        setIsEditing(true)
      }
    },
    [editMeta, isEditing],
  )

  const handleClose = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleSave = useCallback(
    (newValue: {_type: 'reference'; _ref: string} | null) => {
      if (editMeta) {
        editMeta.onSave(row, newValue)
      }
    },
    [editMeta, row],
  )

  const handleOptimisticUpdate = useCallback((prepared: PreviewValue | null) => {
    setOptimisticValue(prepared)
  }, [])

  // Build the popover content — wrapped in Suspense so useDocuments
  // inside ReferenceEditPopover doesn't suspend the app-level Suspense boundary.
  // The Suspense here only catches the INITIAL load. Search re-fetches use
  // startTransition inside ReferenceEditPopover to avoid re-suspending.
  const popoverContent = editMeta ? (
    <Suspense
      fallback={
        <Card padding={4} style={{minWidth: 240, display: 'flex', justifyContent: 'center'}}>
          <Spinner muted />
        </Card>
      }
    >
      <ReferenceEditPopover
        value={editMeta.rawRefValue}
        referenceType={editMeta.referenceType}
        preview={editMeta.preview}
        onSave={handleSave}
        onClose={handleClose}
        onOptimisticUpdate={handleOptimisticUpdate}
      />
    </Suspense>
  ) : null

  // ── Determine display content ──
  let displayContent: React.ReactNode

  if (hasOptimistic && !isEditing) {
    displayContent = renderPrepared(optimisticValue)
  } else if (isEmpty && editMeta) {
    const placeholderText = editMeta.placeholder || 'Add…'
    displayContent = (
      <Card
        padding={1}
        radius={0}
        tone="transparent"
        border
        style={{width: '100%'}}
        data-testid="reference-empty-state"
      >
        <Button padding={2} radius={0} tone="neutral" muted mode="bleed" style={{width: '100%'}}>
          <Flex gap={2} align="center">
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--card-badge-default-bg-color, #e3e4e8)',
                color: 'var(--card-badge-default-fg-color, #515e72)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AddIcon />
            </Box>
            <Text size={1} muted>
              {placeholderText}
            </Text>
          </Flex>
        </Button>
      </Card>
    )
  } else if (isEmpty) {
    displayContent = <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
  } else {
    displayContent = renderDisplay(value, prepare)
  }

  // ── Wrap in Sanity UI Popover (portaled via PortalProvider in SanityDocumentTable) ──
  if (editMeta) {
    return (
      <Popover
        content={popoverContent}
        open={isEditing}
        portal
        placement="bottom-start"
        radius={2}
        shadow={3}
        tone="default"
        animate
      >
        <div
          style={{
            cursor: 'pointer',
            width: '100%',
            ...(isEditing && {
              background: 'var(--card-bg2-color, #f2f3f5)',
              borderRadius: '3px',
            }),
          }}
          onClick={handleClick}
        >
          {displayContent}
        </div>
      </Popover>
    )
  }

  // Non-editable — no popover wrapper
  return <div style={{width: '100%'}}>{displayContent}</div>
}, referenceCellAreEqual)

function isEmptyRef(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj._type === 'reference' && !obj._ref) return true
  return false
}

function renderPrepared(prepared: PreviewValue): React.ReactNode {
  const title = prepared.title || '—'
  const initial = title.charAt(0).toUpperCase()
  const imageUrl = prepared.imageUrl ?? (typeof prepared.media === 'string' ? prepared.media : null)

  return (
    <Card padding={1} radius={0} tone="transparent" border style={{width: '100%'}}>
      <Button padding={2} radius={0} tone="neutral" muted mode="bleed" style={{width: '100%'}}>
        <Flex gap={2} align="center">
          <Box
            data-testid="reference-avatar"
            style={{
              width: 32,
              height: 32,
              background: imageUrl ? 'transparent' : 'var(--card-badge-default-bg-color, #e3e4e8)',
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
            {imageUrl ? (
              <img
                src={imageUrl}
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

function renderDisplay(
  value: unknown,
  prepare: (data: Record<string, unknown>) => PreviewValue,
): React.ReactNode {
  if (typeof value === 'string') {
    return <span>{value || '—'}</span>
  }

  if (typeof value === 'object' && value !== null) {
    try {
      const prepared = prepare(value as Record<string, unknown>)
      return renderPrepared(prepared)
    } catch {
      return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
    }
  }

  return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
}
