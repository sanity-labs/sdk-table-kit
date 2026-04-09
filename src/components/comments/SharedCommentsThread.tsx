import type {SanityUser} from '@sanity/sdk-react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useCallback, useState} from 'react'

import {useAddonCommentMutations} from '../../hooks/useAddonCommentMutations'
import type {
  AddonMessage,
  CommentDocument,
  CommentReaction,
  CommentStatus,
} from '../../types/addonTypes'
import type {SharedCommentsAdapter} from '../../types/comments/sharedCommentsTypes'
import {SharedCommentsComposer} from './SharedCommentsComposer'
import {SharedCommentsEditForm, SharedCommentsItem} from './SharedCommentsItem'

interface SharedCommentsThreadProps {
  commentAdapter: SharedCommentsAdapter
  currentResourceUserId?: string
  documentId: string
  documentTitle: string
  documentType: string
  onOptimisticAdd: (comment: CommentDocument) => () => void
  onOptimisticDelete: (commentId: string) => () => void
  onOptimisticEdit: (commentId: string, message: AddonMessage, lastEditedAt: string) => () => void
  onOptimisticReactions: (commentId: string, reactions: CommentReaction[]) => () => void
  onOptimisticStatus: (commentId: string, status: CommentStatus) => () => void
  parent: CommentDocument
  replies: CommentDocument[]
  users: SanityUser[]
}

export function SharedCommentsThread({
  commentAdapter,
  currentResourceUserId,
  documentId,
  documentTitle,
  documentType,
  onOptimisticAdd,
  onOptimisticDelete,
  onOptimisticEdit,
  onOptimisticReactions,
  onOptimisticStatus,
  parent,
  replies,
  users,
}: SharedCommentsThreadProps) {
  const {deleteComment, editComment, setCommentStatus, toggleReaction} = useAddonCommentMutations()
  const [editingCommentId, setEditingCommentId] = useState<null | string>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<null | string>(null)
  const isResolved = parent.status === 'resolved'

  const handleToggleResolve = useCallback(() => {
    const newStatus: CommentStatus = isResolved ? 'open' : 'resolved'
    const rollback = onOptimisticStatus(parent._id, newStatus)
    setCommentStatus(parent._id, newStatus).catch((error) => {
      console.error('[SharedCommentsThread] setCommentStatus failed', {
        commentId: parent._id,
        error,
        newStatus,
      })
      rollback()
    })
  }, [isResolved, onOptimisticStatus, parent._id, setCommentStatus])

  const handleDelete = useCallback(
    (commentId: string) => {
      const rollback = onOptimisticDelete(commentId)
      deleteComment(commentId).catch((error) => {
        console.error('[SharedCommentsThread] deleteComment failed', {commentId, error})
        rollback()
      })
      setConfirmDeleteId(null)
    },
    [deleteComment, onOptimisticDelete],
  )

  const handleEdit = useCallback(
    (commentId: string, message: AddonMessage) => {
      const now = new Date().toISOString()
      const rollback = onOptimisticEdit(commentId, message, now)
      editComment(commentId, message).catch((error) => {
        console.error('[SharedCommentsThread] editComment failed', {commentId, error})
        rollback()
      })
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
      toggleReaction(commentId, shortName, currentReactions).catch((error) => {
        console.error('[SharedCommentsThread] toggleReaction failed', {
          commentId,
          error,
          shortName,
        })
        rollback()
      })
    },
    [currentResourceUserId, onOptimisticReactions, toggleReaction],
  )

  const renderComment = (comment: CommentDocument, isReply: boolean) => {
    const isOwn = comment.authorId === currentResourceUserId
    const isEditing = editingCommentId === comment._id
    const isConfirmingDelete = confirmDeleteId === comment._id

    if (isEditing) {
      return (
        <SharedCommentsEditForm
          comment={comment}
          isReply={isReply}
          key={comment._id}
          onCancel={() => setEditingCommentId(null)}
          onSave={(message) => handleEdit(comment._id, message)}
          users={users}
        />
      )
    }

    return (
      <div key={comment._id}>
        <SharedCommentsItem
          comment={comment}
          isOwn={isOwn}
          isParent={!isReply}
          isReply={isReply}
          onDelete={(id) => setConfirmDeleteId(id)}
          onEdit={(id) => setEditingCommentId(id)}
          onReaction={handleReaction}
          onResolve={!isReply ? handleToggleResolve : undefined}
          resolveLabel={!isReply ? (isResolved ? 'Reopen' : 'Resolve') : undefined}
          users={users}
        />

        {isConfirmingDelete && (
          <Card padding={2} tone="critical" style={{marginTop: 8}}>
            <Flex align="center" gap={2}>
              <Text size={1}>Delete this comment?</Text>
              <Button
                fontSize={1}
                mode="default"
                onClick={() => handleDelete(comment._id)}
                text="Delete"
                tone="critical"
              />
              <Button
                fontSize={1}
                mode="ghost"
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
    <Card padding={4} radius={2} border tone={isResolved ? 'positive' : 'neutral'}>
      <Stack space={4}>
        {renderComment(parent, false)}

        {replies.length > 0 && (
          <div
            style={{
              borderLeft: '2px solid var(--card-border-color)',
              marginLeft: 18,
              paddingLeft: 14,
            }}
          >
            <Stack space={4}>{replies.map((reply) => renderComment(reply, true))}</Stack>
          </div>
        )}

        <div style={{paddingLeft: 36}}>
          <SharedCommentsComposer
            commentAdapter={commentAdapter}
            currentResourceUserId={currentResourceUserId ?? 'unknown'}
            documentId={documentId}
            documentTitle={documentTitle}
            documentType={documentType}
            fieldPath={parent.target.path?.field}
            onOptimisticAdd={onOptimisticAdd}
            parentCommentId={parent._id}
            placeholder="Reply"
            threadId={parent.threadId ?? parent._id}
          />
        </div>
      </Stack>
    </Card>
  )
}
