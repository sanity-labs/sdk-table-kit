import {useEffect, useMemo, useState} from 'react'

import {getCommentThreadsForField} from '../../helpers/comments/addonCommentUtils'
import {humanizeFieldName} from '../../helpers/comments/commentFieldLabelUtils'
import {useAddonComments} from '../../hooks/useAddonComments'
import type {CommentableCellProps} from '../../types/comments/commentableCellTypes'
import {CommentableCellFrame} from './CommentableCellFrame'

const commentPopoverOpenStore = new Map<string, true>()

export function CommentableCellInner({
  children,
  cellPadding,
  commentFieldLabel,
  commentFieldPath,
  documentId,
  documentTitle,
  documentType,
  editedIndicatorTone,
}: CommentableCellProps) {
  const commentsState = useAddonComments(documentId)
  const {comments} = commentsState
  const stateKey = `${documentId.replace(/^drafts\./, '')}:${commentFieldPath}`
  const [hovered, setHovered] = useState(false)
  const [open, setOpen] = useState(commentPopoverOpenStore.has(stateKey))

  const allThreads = useMemo(
    () => getCommentThreadsForField(comments, {field: commentFieldPath, includeResolved: true}),
    [commentFieldPath, comments],
  )

  const unresolvedCount = allThreads.filter((thread) => thread.parent.status !== 'resolved').length
  const totalCount = allThreads.length
  const showTrigger = hovered || open
  const label = commentFieldLabel ?? humanizeFieldName(commentFieldPath)

  useEffect(() => {
    if (open) {
      commentPopoverOpenStore.set(stateKey, true)
      return
    }
    commentPopoverOpenStore.delete(stateKey)
  }, [open, stateKey])

  return (
    <CommentableCellFrame
      cellPadding={cellPadding}
      commentFieldLabel={label}
      commentFieldPath={commentFieldPath}
      commentsState={commentsState}
      documentId={documentId}
      documentTitle={documentTitle}
      documentType={documentType}
      editedIndicatorTone={editedIndicatorTone}
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
