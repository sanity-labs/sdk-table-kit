import {useMemo, useState} from 'react'

import {getCommentThreadsForField} from '../../helpers/comments/addonCommentUtils'
import {humanizeFieldName} from '../../helpers/comments/commentFieldLabelUtils'
import {useAddonComments} from '../../hooks/useAddonComments'
import type {CommentableCellProps} from '../../types/comments/commentableCellTypes'
import {CommentableCellFrame} from './CommentableCellFrame'

export function CommentableCellInner({
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
      cellPadding={cellPadding}
      commentFieldLabel={label}
      commentFieldPath={commentFieldPath}
      commentsState={commentsState}
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
