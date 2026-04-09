import {
  createComment as createCommentAction,
  createCommentHandle,
  createTaskComment as createTaskCommentAction,
  deleteComment as deleteCommentAction,
  editComment as editCommentAction,
  setCommentStatus as setCommentStatusAction,
  toggleReaction as toggleReactionAction,
  useApplyCommentActions,
} from '@sanity-labs/sdk-comments'
import {useCallback, useMemo} from 'react'

import {useAddonData} from '../context/AddonDataContext'
import type {AddonMessage, CommentReaction, CommentStatus, TaskDocument} from '../types/addonTypes'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

const DEFAULT_STUDIO_BASE_URL = 'https://www.sanity.io/@oNAgKWFqi/studio/beihhm8eq5gszxxix51uhpzo'

export function useAddonCommentMutations() {
  const {addonDataset, contentDataset, projectId, workspaceId, workspaceTitle} = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId()
  const resolvedAuthorId = currentResourceUserId ?? 'unknown'
  const mutationRuntime = useMemo(
    () => ({
      addonDataset,
      contentDataset,
      currentResourceUserId,
      projectId,
      resolvedAuthorId,
      workspaceId,
      workspaceTitle,
    }),
    [
      addonDataset,
      contentDataset,
      currentResourceUserId,
      projectId,
      resolvedAuthorId,
      workspaceId,
      workspaceTitle,
    ],
  )
  const applyCommentActions = useApplyCommentActions({
    addonDataset,
    contentDataset,
    currentUserId: currentResourceUserId,
    projectId,
    studioBaseUrl: DEFAULT_STUDIO_BASE_URL,
    workspaceId,
    workspaceTitle,
  })

  const getCommentHandle = useCallback(
    (commentId: string) =>
      createCommentHandle({
        addonDataset,
        commentId,
        projectId,
      }),
    [addonDataset, projectId],
  )

  const createComment = useCallback(
    async (
      documentId: string,
      documentType: string,
      documentTitle: string,
      message: AddonMessage,
      parentCommentId?: string,
      threadId?: string,
      commentId?: string,
      field?: string,
    ) => {
      if (!contentDataset) {
        throw new Error('Content dataset is not configured')
      }

      const handle = getCommentHandle(commentId ?? crypto.randomUUID())
      const action = createCommentAction(handle, {
        authorId: resolvedAuthorId,
        contentDataset,
        documentId,
        documentTitle,
        documentType,
        fieldPath: field,
        message,
        parentCommentId,
        projectId,
        studioBaseUrl: DEFAULT_STUDIO_BASE_URL,
        threadId,
        workspaceId,
        workspaceTitle,
      })

      console.debug('[useAddonCommentMutations] createComment:start', {
        action,
        commentId: handle.documentId,
        documentId,
        documentTitle,
        documentType,
        field,
        handle,
        parentCommentId,
        runtime: mutationRuntime,
        threadId,
      })

      try {
        const result = await applyCommentActions(action)
        console.debug('[useAddonCommentMutations] createComment:success', {
          commentId: handle.documentId,
          result,
          runtime: mutationRuntime,
        })
        return result
      } catch (error) {
        console.error('[useAddonCommentMutations] createComment:failed', {
          action,
          commentId: handle.documentId,
          documentId,
          documentTitle,
          documentType,
          error,
          field,
          handle,
          parentCommentId,
          runtime: mutationRuntime,
          threadId,
        })
        throw error
      }
    },
    [
      applyCommentActions,
      contentDataset,
      getCommentHandle,
      mutationRuntime,
      projectId,
      resolvedAuthorId,
      workspaceId,
      workspaceTitle,
    ],
  )

  const createTaskComment = useCallback(
    async (
      task: Pick<TaskDocument, '_id' | 'context' | 'subscribers' | 'title'>,
      message: AddonMessage,
      parentCommentId?: string,
      threadId?: string,
      commentId?: string,
    ) => {
      const handle = getCommentHandle(commentId ?? crypto.randomUUID())
      const action = createTaskCommentAction(handle, {
        authorId: resolvedAuthorId,
        message,
        parentCommentId,
        subscribers: task.subscribers,
        taskId: task._id,
        taskStudioUrl: task.context?.notification?.url,
        taskTitle: task.title,
        threadId,
        workspaceId,
        workspaceTitle,
      })

      console.debug('[useAddonCommentMutations] createTaskComment:start', {
        action,
        commentId: handle.documentId,
        handle,
        parentCommentId,
        runtime: mutationRuntime,
        taskId: task._id,
        threadId,
      })

      try {
        const result = await applyCommentActions(action)
        console.debug('[useAddonCommentMutations] createTaskComment:success', {
          commentId: handle.documentId,
          result,
          runtime: mutationRuntime,
          taskId: task._id,
        })
        return result
      } catch (error) {
        console.error('[useAddonCommentMutations] createTaskComment:failed', {
          action,
          commentId: handle.documentId,
          error,
          handle,
          parentCommentId,
          runtime: mutationRuntime,
          taskId: task._id,
          threadId,
        })
        throw error
      }
    },
    [
      applyCommentActions,
      getCommentHandle,
      mutationRuntime,
      resolvedAuthorId,
      workspaceId,
      workspaceTitle,
    ],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      const handle = getCommentHandle(commentId)
      const action = deleteCommentAction(handle)

      console.debug('[useAddonCommentMutations] deleteComment:start', {
        action,
        commentId,
        handle,
        runtime: mutationRuntime,
      })

      try {
        const result = await applyCommentActions(action)
        console.debug('[useAddonCommentMutations] deleteComment:success', {
          commentId,
          result,
          runtime: mutationRuntime,
        })
        return result
      } catch (error) {
        console.error('[useAddonCommentMutations] deleteComment:failed', {
          action,
          commentId,
          error,
          handle,
          runtime: mutationRuntime,
        })
        throw error
      }
    },
    [applyCommentActions, getCommentHandle, mutationRuntime],
  )

  const editComment = useCallback(
    async (commentId: string, message: AddonMessage) => {
      const handle = getCommentHandle(commentId)
      const action = editCommentAction(handle, message)

      console.debug('[useAddonCommentMutations] editComment:start', {
        action,
        commentId,
        handle,
        runtime: mutationRuntime,
      })

      try {
        const result = await applyCommentActions(action)
        console.debug('[useAddonCommentMutations] editComment:success', {
          commentId,
          result,
          runtime: mutationRuntime,
        })
        return result
      } catch (error) {
        console.error('[useAddonCommentMutations] editComment:failed', {
          action,
          commentId,
          error,
          handle,
          runtime: mutationRuntime,
        })
        throw error
      }
    },
    [applyCommentActions, getCommentHandle, mutationRuntime],
  )

  const setCommentStatus = useCallback(
    async (commentId: string, status: CommentStatus) => {
      const handle = getCommentHandle(commentId)
      const action = setCommentStatusAction(handle, status)

      console.debug('[useAddonCommentMutations] setCommentStatus:start', {
        action,
        commentId,
        handle,
        runtime: mutationRuntime,
        status,
      })

      try {
        const result = await applyCommentActions(action)
        console.debug('[useAddonCommentMutations] setCommentStatus:success', {
          commentId,
          result,
          runtime: mutationRuntime,
          status,
        })
        return result
      } catch (error) {
        console.error('[useAddonCommentMutations] setCommentStatus:failed', {
          action,
          commentId,
          error,
          handle,
          runtime: mutationRuntime,
          status,
        })
        throw error
      }
    },
    [applyCommentActions, getCommentHandle, mutationRuntime],
  )

  const toggleReaction = useCallback(
    async (commentId: string, shortName: string, currentReactions: CommentReaction[]) => {
      const handle = getCommentHandle(commentId)
      const action = toggleReactionAction(handle, {
        currentReactions,
        currentUserId: resolvedAuthorId,
        shortName,
      })

      console.debug('[useAddonCommentMutations] toggleReaction:start', {
        action,
        commentId,
        handle,
        runtime: mutationRuntime,
        shortName,
      })

      try {
        const result = await applyCommentActions(action)
        console.debug('[useAddonCommentMutations] toggleReaction:success', {
          commentId,
          result,
          runtime: mutationRuntime,
          shortName,
        })
        return result
      } catch (error) {
        console.error('[useAddonCommentMutations] toggleReaction:failed', {
          action,
          commentId,
          error,
          handle,
          runtime: mutationRuntime,
          shortName,
        })
        throw error
      }
    },
    [applyCommentActions, getCommentHandle, mutationRuntime, resolvedAuthorId],
  )

  return {
    createComment,
    createTaskComment,
    deleteComment,
    editComment,
    setCommentStatus,
    toggleReaction,
  }
}
