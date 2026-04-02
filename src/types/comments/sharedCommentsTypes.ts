import type {AddonMessage, CommentDocument, CommentReaction, CommentStatus} from '../addonTypes'

export interface CommentComposerArgs {
  commentId?: string
  documentId: string
  documentTitle: string
  documentType: string
  fieldPath?: string
  message: AddonMessage
  parentCommentId?: string
  threadId?: string
}

export interface SharedCommentsAdapter {
  buildOptimisticComment: (
    args: CommentComposerArgs & {
      authorId: string
    },
  ) => CommentDocument
  createComment: (args: CommentComposerArgs) => Promise<unknown>
}

export interface SharedCommentsState {
  addOptimisticComment: (comment: CommentDocument) => () => void
  comments: CommentDocument[]
  deleteOptimisticComment: (commentId: string) => () => void
  editOptimisticComment: (
    commentId: string,
    message: AddonMessage,
    lastEditedAt: string,
  ) => () => void
  isPending: boolean
  updateOptimisticReactions: (commentId: string, reactions: CommentReaction[]) => () => void
  updateOptimisticStatus: (commentId: string, status: CommentStatus) => () => void
}
