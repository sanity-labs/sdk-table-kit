import {useApplyCommentActions} from '@sanity-labs/sdk-comments'

import {useAddonData} from '../context/AddonDataContext'
import type {AddonMessage, CommentReaction, CommentStatus, TaskDocument} from '../types/addonTypes'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

const DEFAULT_STUDIO_BASE_URL = 'https://www.sanity.io/@oNAgKWFqi/studio/beihhm8eq5gszxxix51uhpzo'

export function useAddonCommentMutations() {
  const {workspaceId, workspaceTitle} = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId()
  const mutations = useApplyCommentActions({
    currentUserId: currentResourceUserId,
    studioBaseUrl: DEFAULT_STUDIO_BASE_URL,
    workspaceId,
    workspaceTitle,
  })

  const createComment = (
    documentId: string,
    documentType: string,
    documentTitle: string,
    message: AddonMessage,
    parentCommentId?: string,
    threadId?: string,
    commentId?: string,
    field?: string,
  ) =>
    mutations.createComment({
      commentId,
      documentId,
      documentTitle,
      documentType,
      fieldPath: field,
      message,
      parentCommentId,
      threadId,
    })

  const createTaskComment = (
    task: Pick<TaskDocument, '_id' | 'context' | 'subscribers' | 'title'>,
    message: AddonMessage,
    parentCommentId?: string,
    threadId?: string,
    commentId?: string,
  ) =>
    mutations.createTaskComment({
      commentId,
      message,
      parentCommentId,
      subscribers: task.subscribers,
      taskId: task._id,
      taskStudioUrl: task.context?.notification?.url,
      taskTitle: task.title,
      threadId,
    })

  return {
    createComment,
    createTaskComment,
    deleteComment: mutations.deleteComment as (commentId: string) => Promise<unknown>,
    editComment: mutations.editComment as (
      commentId: string,
      message: AddonMessage,
    ) => Promise<unknown>,
    setCommentStatus: mutations.setCommentStatus as (
      commentId: string,
      status: CommentStatus,
    ) => Promise<unknown>,
    toggleReaction: mutations.toggleReaction as (
      commentId: string,
      shortName: string,
      currentReactions: CommentReaction[],
    ) => Promise<unknown>,
  }
}
