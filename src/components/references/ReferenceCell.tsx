import type {PreviewValue} from '@sanity/types'
import {Card, Popover, Spinner} from '@sanity/ui'
import React, {useState, useCallback, useEffect, memo, Suspense} from 'react'

import {referenceCellAreEqual} from '../../helpers/references/referenceCellAreEqual'
import {
  isEmptyRef,
  renderEmptyReferenceCell,
  renderPreparedReference,
  renderReferenceDisplay,
} from '../../helpers/references/referenceCellDisplay'
import type {ReferenceCellProps} from '../../types/references/referenceCellTypes'
import {ReferenceEditPopover} from './ReferenceEditPopover'

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
    displayContent = renderPreparedReference(optimisticValue)
  } else if (isEmpty && editMeta) {
    const placeholderText = editMeta.placeholder || 'Add…'
    displayContent = renderEmptyReferenceCell(placeholderText)
  } else if (isEmpty) {
    displayContent = <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
  } else {
    displayContent = renderReferenceDisplay(value, prepare)
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
