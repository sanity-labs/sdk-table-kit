import {CommentIcon} from '@sanity/icons'
import {
  Badge,
  Button,
  Card,
  Heading,
  Popover,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import React, {Suspense, useCallback, useMemo, useRef, useState} from 'react'

import {ActionBar} from './ActionBar'
import {getCommentThreadsForField} from './addonCommentUtils'
import {useOptionalAddonData} from './AddonDataContext'
import {SharedCommentsPanel} from './SharedCommentsPanel'
import {useAddonComments} from './useAddonComments'

interface CommentableCellProps {
  cellPadding: {x: number; y: number}
  children: React.ReactNode
  commentFieldLabel?: string
  commentFieldPath: string
  documentId: string
  documentTitle?: string
  documentType: string
}

export function CommentableCell(props: CommentableCellProps) {
  const addonData = useOptionalAddonData()

  if (!addonData) {
    return <>{props.children}</>
  }

  return (
    <Suspense fallback={<>{props.children}</>}>
      <CommentableCellInner {...props} />
    </Suspense>
  )
}

function CommentableCellInner({
  children,
  cellPadding,
  commentFieldLabel,
  commentFieldPath,
  documentId,
  documentTitle,
  documentType,
}: CommentableCellProps) {
  const commentsState = useAddonComments(documentId)
  const {comments} = commentsState
  const [hovered, setHovered] = useState(false)
  const [open, setOpen] = useState(false)

  const allThreads = useMemo(
    () => getCommentThreadsForField(comments, {field: commentFieldPath, includeResolved: true}),
    [commentFieldPath, comments],
  )

  const unresolvedCount = allThreads.filter((thread) => thread.parent.status !== 'resolved').length
  const totalCount = allThreads.length
  const showTrigger = hovered || open

  const label = commentFieldLabel ?? humanizeFieldName(commentFieldPath)

  return (
    <CommentableCellFrame
      commentsState={commentsState}
      commentFieldLabel={label}
      commentFieldPath={commentFieldPath}
      cellPadding={cellPadding}
      documentId={documentId}
      documentTitle={documentTitle}
      documentType={documentType}
      onHoverChange={setHovered}
      open={open}
      setOpen={setOpen}
      showTrigger={showTrigger}
      totalCount={totalCount}
      unresolvedCount={unresolvedCount}
    >
      {children}
    </CommentableCellFrame>
  )
}

function CommentableCellFrame({
  children,
  cellPadding,
  commentsState,
  commentFieldLabel,
  commentFieldPath,
  documentId,
  documentTitle,
  documentType,
  onHoverChange,
  open,
  setOpen,
  showTrigger,
  totalCount,
  unresolvedCount,
}: {
  children: React.ReactNode
  cellPadding: {x: number; y: number}
  commentsState: ReturnType<typeof useAddonComments>
  commentFieldLabel: string
  commentFieldPath: string
  documentId: string
  documentTitle?: string
  documentType: string
  onHoverChange: (hovered: boolean) => void
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  showTrigger: boolean
  totalCount: number
  unresolvedCount: number
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closePopover = useCallback(() => {
    setOpen(false)
  }, [setOpen])
  const hasOpenComments = unresolvedCount > 0

  useClickOutsideEvent(open ? closePopover : undefined, () => [
    popoverRef.current,
    triggerRef.current,
  ])
  useGlobalKeyDown((event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    closePopover()
  })

  return (
    <div
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
        boxShadow: hasOpenComments ? 'inset 0 -3px 0 rgb(249, 233, 148)' : undefined,
        margin: `${cellPadding.y * -1}px ${cellPadding.x * -1}px`,
        minHeight: `calc(100% + ${cellPadding.y * 2}px)`,
        padding: `${cellPadding.y}px ${cellPadding.x}px`,
        position: 'relative',
        width: `calc(100% + ${cellPadding.x * 2}px)`,
      }}
    >
      <div>{children}</div>

      <Popover
        animate
        content={
          <Card
            padding={4}
            radius={3}
            ref={popoverRef}
            shadow={3}
            style={{
              maxHeight: 520,
              maxWidth: 'min(720px, calc(100vw - 32px))',
              overflowX: 'hidden',
              overflowY: 'auto',
              width: 'min(480px, calc(100vw - 32px))',
            }}
          >
            <div style={{minWidth: 0, width: '100%'}}>
              <Heading size={2} weight="medium" style={{marginBottom: 16}}>
                {commentFieldLabel} comments
              </Heading>
              <SharedCommentsPanel
                commentsState={commentsState}
                documentId={documentId}
                documentTitle={documentTitle ?? ''}
                documentType={documentType}
                fieldPath={commentFieldPath}
              />
            </div>
          </Card>
        }
        open={open}
        placement="bottom"
        portal
        radius={3}
        shadow={3}
      >
        <ActionBar placement={{right: 10, top: 10}} visible={showTrigger}>
          <div style={{position: 'relative'}}>
            <Button
              fontSize={1}
              mode="bleed"
              onClick={(event) => {
                event.stopPropagation()
                setOpen((current) => !current)
              }}
              padding={2}
              ref={triggerRef}
              style={{
                cursor: 'pointer',
              }}
              icon={<CommentIcon />}
              title={`${commentFieldLabel} comments`}
            />
            {totalCount > 0 && (
              <Badge
                style={{
                  border: '1px solid var(--card-border-color)',
                  position: 'absolute',
                  right: -12,
                  top: -12,
                  aspectRatio: 1,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                tone={unresolvedCount > 0 ? 'caution' : 'default'}
                padding={1}
              >
                {unresolvedCount > 0 ? unresolvedCount : totalCount}
              </Badge>
            )}
          </div>
        </ActionBar>
      </Popover>
    </div>
  )
}

function humanizeFieldName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (value) => value.toUpperCase())
}
