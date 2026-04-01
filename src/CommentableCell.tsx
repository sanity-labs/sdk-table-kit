import {CommentIcon} from '@sanity/icons'
import {Badge, Button, Card, Flex, Heading, Popover, Stack, Switch, Text} from '@sanity/ui'
import React, {Suspense, useCallback, useMemo, useRef, useState} from 'react'

import {
  buildCommentDocument,
  getCommentThreadsForField,
  type CommentThread,
} from './addonCommentUtils'
import {useOptionalAddonData} from './AddonDataContext'
import type {AddonMessage, CommentReaction, CommentStatus} from './addonTypes'
import {CommentInput, type CommentInputHandle} from './CommentInput'
import {CommentThreadItem, EditCommentCard} from './CommentThreadItem'
import {useAddonCommentMutations} from './useAddonCommentMutations'
import {useAddonComments} from './useAddonComments'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

interface CommentableCellProps {
  cellPadding: {x: number; y: number}
  children: React.ReactNode
  commentFieldLabel?: string
  commentFieldPath: string
  documentId: string
  documentTitle?: string
  documentType: string
}

interface ThreadItemProps {
  commentFieldPath: string
  currentResourceUserId?: string
  documentId: string
  documentTitle?: string
  documentType: string
  onOptimisticAdd: ReturnType<typeof useAddonComments>['addOptimisticComment']
  onOptimisticDelete: ReturnType<typeof useAddonComments>['deleteOptimisticComment']
  onOptimisticEdit: ReturnType<typeof useAddonComments>['editOptimisticComment']
  onOptimisticReactions: ReturnType<typeof useAddonComments>['updateOptimisticReactions']
  onOptimisticStatus: ReturnType<typeof useAddonComments>['updateOptimisticStatus']
  thread: CommentThread
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
  const {
    addOptimisticComment,
    comments,
    deleteOptimisticComment,
    editOptimisticComment,
    updateOptimisticReactions,
    updateOptimisticStatus,
  } = useAddonComments(documentId)
  const [hovered, setHovered] = useState(false)
  const [open, setOpen] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const currentResourceUserId = useCurrentResourceUserId()

  const allThreads = useMemo(
    () => getCommentThreadsForField(comments, {field: commentFieldPath, includeResolved: true}),
    [commentFieldPath, comments],
  )

  const visibleThreads = useMemo(
    () =>
      getCommentThreadsForField(comments, {
        field: commentFieldPath,
        includeResolved: showResolved,
      }),
    [commentFieldPath, comments, showResolved],
  )

  const unresolvedCount = allThreads.filter((thread) => thread.parent.status !== 'resolved').length
  const totalCount = allThreads.length
  const showTrigger = hovered || open
  const label = commentFieldLabel ?? humanizeFieldName(commentFieldPath)

  return (
    <CommentableCellFrame
      cellPadding={cellPadding}
      commentFieldLabel={label}
      commentFieldPath={commentFieldPath}
      currentResourceUserId={currentResourceUserId}
      documentId={documentId}
      documentTitle={documentTitle}
      documentType={documentType}
      onHoverChange={setHovered}
      onOptimisticAdd={addOptimisticComment}
      onOptimisticDelete={deleteOptimisticComment}
      onOptimisticEdit={editOptimisticComment}
      onOptimisticReactions={updateOptimisticReactions}
      onOptimisticStatus={updateOptimisticStatus}
      open={open}
      setOpen={setOpen}
      showResolved={showResolved}
      showTrigger={showTrigger}
      threads={visibleThreads}
      totalCount={totalCount}
      unresolvedCount={unresolvedCount}
      onShowResolvedChange={setShowResolved}
    >
      {children}
    </CommentableCellFrame>
  )
}

function CommentableCellFrame({
  cellPadding,
  children,
  commentFieldLabel,
  commentFieldPath,
  currentResourceUserId,
  documentId,
  documentTitle,
  documentType,
  onHoverChange,
  onOptimisticAdd,
  onOptimisticDelete,
  onOptimisticEdit,
  onOptimisticReactions,
  onOptimisticStatus,
  open,
  setOpen,
  showResolved,
  showTrigger,
  threads,
  totalCount,
  unresolvedCount,
  onShowResolvedChange,
}: {
  cellPadding: {x: number; y: number}
  children: React.ReactNode
  commentFieldLabel: string
  commentFieldPath: string
  currentResourceUserId?: string
  documentId: string
  documentTitle?: string
  documentType: string
  onHoverChange: (hovered: boolean) => void
  onOptimisticAdd: ReturnType<typeof useAddonComments>['addOptimisticComment']
  onOptimisticDelete: ReturnType<typeof useAddonComments>['deleteOptimisticComment']
  onOptimisticEdit: ReturnType<typeof useAddonComments>['editOptimisticComment']
  onOptimisticReactions: ReturnType<typeof useAddonComments>['updateOptimisticReactions']
  onOptimisticStatus: ReturnType<typeof useAddonComments>['updateOptimisticStatus']
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  showResolved: boolean
  showTrigger: boolean
  threads: CommentThread[]
  totalCount: number
  unresolvedCount: number
  onShowResolvedChange: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const addonData = useOptionalAddonData()
  const {createComment} = useAddonCommentMutations()
  const composerRef = useRef<CommentInputHandle>(null)

  const handleCreateTopLevelComment = useCallback(async () => {
    const message = composerRef.current?.getValue()
    if (!message || !addonData?.contentDataset || !currentResourceUserId) return

    const commentId = crypto.randomUUID()
    const rollback = onOptimisticAdd(
      buildCommentDocument({
        authorId: currentResourceUserId,
        commentId,
        contentDataset: addonData.contentDataset,
        documentId,
        documentTitle,
        documentType,
        field: commentFieldPath,
        message,
        projectId: addonData.projectId,
        workspaceId: addonData.workspaceId,
        workspaceTitle: addonData.workspaceTitle,
      }),
    )

    try {
      await createComment(
        documentId,
        documentType,
        documentTitle ?? '',
        message,
        undefined,
        undefined,
        commentId,
        commentFieldPath,
      )
      composerRef.current?.clear()
    } catch (error) {
      rollback()
      console.error('[CommentableCell] create comment failed:', error)
    }
  }, [
    addonData?.contentDataset,
    addonData?.projectId,
    addonData?.workspaceId,
    addonData?.workspaceTitle,
    commentFieldPath,
    createComment,
    currentResourceUserId,
    documentId,
    documentTitle,
    documentType,
    onOptimisticAdd,
  ])

  return (
    <div
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
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
            shadow={3}
            style={{maxHeight: 520, minWidth: 420, overflow: 'auto'}}
          >
            <Stack space={4}>
              <Flex align="center" justify="space-between">
                <Heading size={2} weight="medium">
                  {commentFieldLabel} comments
                </Heading>
                <Flex align="center" gap={2}>
                  <Text muted size={1}>
                    Show resolved
                  </Text>
                  <Switch
                    checked={showResolved}
                    onChange={(event) => onShowResolvedChange(event.currentTarget.checked)}
                  />
                </Flex>
              </Flex>

              {threads.length > 0 ? (
                <Stack space={3}>
                  {threads.map((thread) => (
                    <ThreadItem
                      commentFieldPath={commentFieldPath}
                      currentResourceUserId={currentResourceUserId}
                      documentId={documentId}
                      documentTitle={documentTitle}
                      documentType={documentType}
                      key={thread.parent._id}
                      onOptimisticAdd={onOptimisticAdd}
                      onOptimisticDelete={onOptimisticDelete}
                      onOptimisticEdit={onOptimisticEdit}
                      onOptimisticReactions={onOptimisticReactions}
                      onOptimisticStatus={onOptimisticStatus}
                      thread={thread}
                    />
                  ))}
                </Stack>
              ) : (
                <Card padding={3} radius={2} tone="transparent" border>
                  <Text muted size={1}>
                    {showResolved
                      ? 'No comments on this field yet.'
                      : 'No open comments on this field.'}
                  </Text>
                </Card>
              )}

              <Stack space={2}>
                <Text size={1} weight="medium">
                  Add comment
                </Text>
                <CommentInput
                  onSubmit={() => {
                    void handleCreateTopLevelComment()
                  }}
                  placeholder={`Add a comment about ${commentFieldLabel.toLowerCase()}...`}
                  ref={composerRef}
                  showSendButton
                />
              </Stack>
            </Stack>
          </Card>
        }
        open={open}
        placement="bottom"
        portal
        radius={3}
        shadow={3}
      >
        <div style={{position: 'absolute', right: 10, bottom: 10, zIndex: 1}}>
          <Button
            icon={<CommentIcon />}
            onClick={(event) => {
              event.stopPropagation()
              setOpen((current) => !current)
            }}
            style={{
              cursor: 'pointer',
              display: 'relative',
              height: 24,
              opacity: showTrigger ? 1 : 0,
              pointerEvents: showTrigger ? 'auto' : 'none',
              position: 'absolute',
              right: 0,
              bottom: 0,
              transition: 'opacity 120ms ease',
              width: 24,
            }}
            tone="neutral"
          />
          {totalCount > 0 && (
            <Badge
              padding={1}
              style={{
                border: '1px solid var(--card-border-color)',
                opacity: showTrigger ? 1 : 0,
                pointerEvents: showTrigger ? 'auto' : 'none',
                position: 'relative',
                right: -8,
                top: -8,
                transition: 'opacity 120ms ease',
              }}
              tone={unresolvedCount > 0 ? 'caution' : 'default'}
            >
              {unresolvedCount > 0 ? unresolvedCount : totalCount}
            </Badge>
          )}
        </div>
      </Popover>
    </div>
  )
}

function ThreadItem({
  commentFieldPath,
  currentResourceUserId,
  documentId,
  documentTitle,
  documentType,
  onOptimisticAdd,
  onOptimisticDelete,
  onOptimisticEdit,
  onOptimisticReactions,
  onOptimisticStatus,
  thread,
}: ThreadItemProps) {
  const addonData = useOptionalAddonData()
  const {createComment, deleteComment, editComment, setCommentStatus, toggleReaction} =
    useAddonCommentMutations()
  const replyRef = useRef<CommentInputHandle>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<null | string>(null)
  const [editingCommentId, setEditingCommentId] = useState<null | string>(null)
  const [submitting, setSubmitting] = useState(false)
  const isResolved = thread.parent.status === 'resolved'

  const handleSubmitReply = useCallback(async () => {
    const message = replyRef.current?.getValue()
    if (!message || !addonData?.contentDataset || !currentResourceUserId) return

    setSubmitting(true)
    const commentId = crypto.randomUUID()
    const rollback = onOptimisticAdd(
      buildCommentDocument({
        authorId: currentResourceUserId,
        commentId,
        contentDataset: addonData.contentDataset,
        documentId,
        documentTitle,
        documentType,
        field: commentFieldPath,
        message,
        parentCommentId: thread.parent._id,
        projectId: addonData.projectId,
        threadId: thread.parent.threadId ?? thread.parent._id,
        workspaceId: addonData.workspaceId,
        workspaceTitle: addonData.workspaceTitle,
      }),
    )

    try {
      await createComment(
        documentId,
        documentType,
        documentTitle ?? '',
        message,
        thread.parent._id,
        thread.parent.threadId ?? thread.parent._id,
        commentId,
        commentFieldPath,
      )
      replyRef.current?.clear()
    } catch (error) {
      rollback()
      console.error('[CommentableCell] reply failed:', error)
    } finally {
      setSubmitting(false)
    }
  }, [
    addonData?.contentDataset,
    addonData?.projectId,
    addonData?.workspaceId,
    addonData?.workspaceTitle,
    commentFieldPath,
    createComment,
    currentResourceUserId,
    documentId,
    documentTitle,
    documentType,
    onOptimisticAdd,
    thread.parent._id,
    thread.parent.threadId,
  ])

  const handleToggleResolved = useCallback(() => {
    const nextStatus: CommentStatus = isResolved ? 'open' : 'resolved'
    const rollback = onOptimisticStatus(thread.parent._id, nextStatus)
    setCommentStatus(thread.parent._id, nextStatus).catch(() => rollback())
  }, [isResolved, onOptimisticStatus, setCommentStatus, thread.parent._id])

  const handleDelete = useCallback(
    (commentId: string) => {
      const rollback = onOptimisticDelete(commentId)
      deleteComment(commentId).catch(() => rollback())
      setConfirmDeleteId(null)
    },
    [deleteComment, onOptimisticDelete],
  )

  const handleEdit = useCallback(
    (commentId: string, message: AddonMessage) => {
      const now = new Date().toISOString()
      const rollback = onOptimisticEdit(commentId, message, now)
      editComment(commentId, message).catch(() => rollback())
      setEditingCommentId(null)
    },
    [editComment, onOptimisticEdit],
  )

  const handleReaction = useCallback(
    (commentId: string, shortName: string, currentReactions: CommentReaction[]) => {
      const userId = currentResourceUserId ?? 'unknown'
      const existing = currentReactions.find(
        (reaction) => reaction.shortName === shortName && reaction.userId === userId,
      )
      const nextReactions = existing
        ? currentReactions.filter((reaction) => reaction._key !== existing._key)
        : [
            ...currentReactions,
            {
              _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
              addedAt: new Date().toISOString(),
              shortName,
              userId,
            },
          ]

      const rollback = onOptimisticReactions(commentId, nextReactions)
      toggleReaction(commentId, shortName, currentReactions).catch(() => rollback())
    },
    [currentResourceUserId, onOptimisticReactions, toggleReaction],
  )

  const renderComment = (comment: CommentThread['parent'], isReply: boolean) => {
    if (editingCommentId === comment._id) {
      return (
        <EditCommentCard
          comment={comment}
          isReply={isReply}
          key={comment._id}
          onCancel={() => setEditingCommentId(null)}
          onSave={(message) => handleEdit(comment._id, message)}
        />
      )
    }

    return (
      <div key={comment._id}>
        <CommentThreadItem
          comment={comment}
          currentResourceUserId={currentResourceUserId}
          isParent={!isReply}
          isReply={isReply}
          onDelete={(commentId) => setConfirmDeleteId(commentId)}
          onEdit={(commentId) => setEditingCommentId(commentId)}
          onReaction={handleReaction}
          onResolve={!isReply ? handleToggleResolved : undefined}
          resolveLabel={!isReply ? (isResolved ? 'Reopen' : 'Resolve') : undefined}
        />
        {confirmDeleteId === comment._id && (
          <Card padding={3} radius={2} tone="critical">
            <Flex align="center" gap={2}>
              <Text size={1}>Delete this comment?</Text>
              <Button
                fontSize={1}
                mode="bleed"
                onClick={() => handleDelete(comment._id)}
                text="Delete"
                tone="critical"
              />
              <Button
                fontSize={1}
                mode="bleed"
                onClick={() => setConfirmDeleteId(null)}
                text="Cancel"
              />
            </Flex>
          </Card>
        )}
      </div>
    )
  }

  return (
    <Card padding={3} radius={2} tone="transparent" border style={{opacity: isResolved ? 0.72 : 1}}>
      <Stack space={3}>
        {renderComment(thread.parent, false)}

        {thread.replies.length > 0 && (
          <Stack space={4} style={{marginLeft: 16}}>
            {thread.replies.map((reply) => renderComment(reply, true))}
          </Stack>
        )}

        <div style={{marginLeft: 40}}>
          <CommentInput
            onSubmit={() => {
              void handleSubmitReply()
            }}
            placeholder="Reply"
            ref={replyRef}
            showSendButton
          />
          {submitting && (
            <Text muted size={1}>
              Sending...
            </Text>
          )}
        </div>
      </Stack>
    </Card>
  )
}

function humanizeFieldName(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (value) => value.toUpperCase())
}
