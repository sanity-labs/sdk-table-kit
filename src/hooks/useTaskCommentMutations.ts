import type {AddonMessage, TaskDocument} from '../types/addonTypes'
import {useAddonCommentMutations} from './useAddonCommentMutations'

export function useTaskCommentMutations(
  task: Pick<TaskDocument, '_id' | 'context' | 'subscribers' | 'title'>,
) {
  const {createTaskComment, deleteComment, editComment, setCommentStatus, toggleReaction} =
    useAddonCommentMutations()

  return {
    createComment: (
      message: AddonMessage,
      parentCommentId?: string,
      threadId?: string,
      commentId?: string,
    ) => createTaskComment(task, message, parentCommentId, threadId, commentId),
    deleteComment,
    editComment,
    setCommentStatus,
    toggleReaction,
  }
}
