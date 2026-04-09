import {useCallback, useRef} from 'react'

import type {AddonMessage, CommentDocument} from '../../types/addonTypes'
import type {SharedCommentsAdapter} from '../../types/comments/sharedCommentsTypes'
import {CommentInput, type CommentInputHandle} from './CommentInput'

interface SharedCommentsComposerProps {
  autoFocus?: boolean
  commentAdapter: SharedCommentsAdapter
  currentResourceUserId: string
  documentId: string
  documentTitle: string
  documentType: string
  fieldPath?: string
  onCancel?: () => void
  onOptimisticAdd: (comment: CommentDocument) => () => void
  parentCommentId?: string
  placeholder: string
  threadId?: string
}

export function SharedCommentsComposer({
  autoFocus,
  commentAdapter,
  currentResourceUserId,
  documentId,
  documentTitle,
  documentType,
  fieldPath,
  onCancel,
  onOptimisticAdd,
  parentCommentId,
  placeholder,
  threadId,
}: SharedCommentsComposerProps) {
  const inputRef = useRef<CommentInputHandle>(null)

  const handleSubmit = useCallback(
    (message: AddonMessage) => {
      if (!message || message.length === 0) return

      const commentId = crypto.randomUUID()
      const optimisticComment = commentAdapter.buildOptimisticComment({
        authorId: currentResourceUserId,
        commentId,
        documentId,
        documentTitle,
        documentType,
        fieldPath,
        message,
        parentCommentId,
        threadId,
      })

      const rollback = onOptimisticAdd(optimisticComment)

      commentAdapter
        .createComment({
          commentId,
          documentId,
          documentTitle,
          documentType,
          fieldPath,
          message,
          parentCommentId,
          threadId,
        })
        .catch((error) => {
          console.error('[SharedCommentsComposer] createComment failed', {
            commentId,
            documentId,
            documentType,
            error,
            fieldPath,
            parentCommentId,
            threadId,
          })
          rollback()
        })

      inputRef.current?.clear()
      onCancel?.()
    },
    [
      commentAdapter,
      currentResourceUserId,
      documentId,
      documentTitle,
      documentType,
      fieldPath,
      onCancel,
      onOptimisticAdd,
      parentCommentId,
      threadId,
    ],
  )

  return (
    <CommentInput
      autoFocus={autoFocus ?? !!parentCommentId}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      placeholder={placeholder}
      ref={inputRef}
      showSendButton
    />
  )
}
