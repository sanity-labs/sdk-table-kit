import {
  createCommentHandle,
  createTaskComment as createTaskCommentAction,
  useApplyCommentActions,
} from '@sanity-labs/sdk-comments'
import {
  createTask as createTaskAction,
  createTaskHandle,
  deleteTask as deleteTaskAction,
  editTask as editTaskAction,
  setTaskStatus as setTaskStatusAction,
  useApplyTaskActions,
} from '@sanity-labs/sdk-tasks'
import {useCallback, useMemo} from 'react'

import {useAddonData} from '../context/AddonDataContext'
import type {AddonMessage, TaskEditPayload, TaskStatus} from '../types/addonTypes'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

export function useAddonTaskMutations() {
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

  const applyTaskActions = useApplyTaskActions({
    addonDataset,
    contentDataset,
    currentUserId: currentResourceUserId,
    projectId,
    workspaceId,
    workspaceTitle,
  })
  const applyCommentActions = useApplyCommentActions({
    addonDataset,
    contentDataset,
    currentUserId: currentResourceUserId,
    projectId,
    workspaceId,
    workspaceTitle,
  })

  const getTaskHandle = useCallback(
    (taskId: string) =>
      createTaskHandle({
        addonDataset,
        projectId,
        taskId,
      }),
    [addonDataset, projectId],
  )

  const getCommentHandle = useCallback(
    (commentId: string) =>
      createCommentHandle({
        addonDataset,
        commentId,
        projectId,
      }),
    [addonDataset, projectId],
  )

  const createTask = useCallback(
    async (
      documentId: string,
      documentType: string,
      title: string,
      assignedTo?: string,
      dueBy?: string,
      description?: AddonMessage,
    ) => {
      if (!contentDataset) {
        throw new Error('Content dataset is not configured')
      }

      const handle = getTaskHandle(crypto.randomUUID())
      const action = createTaskAction(handle, {
        assignedTo,
        authorId: resolvedAuthorId,
        contentDataset,
        description,
        documentId,
        documentType,
        dueBy,
        title,
        workspaceId,
        workspaceTitle,
      })

      console.debug('[useAddonTaskMutations] createTask:start', {
        action,
        assignedTo,
        description,
        documentId,
        documentType,
        dueBy,
        handle,
        runtime: mutationRuntime,
        title,
      })

      try {
        const result = await applyTaskActions(action)
        console.debug('[useAddonTaskMutations] createTask:success', {
          result,
          runtime: mutationRuntime,
          taskId: handle.documentId,
        })
      } catch (error) {
        console.error('[useAddonTaskMutations] createTask:failed', {
          action,
          assignedTo,
          description,
          documentId,
          documentType,
          dueBy,
          error,
          handle,
          runtime: mutationRuntime,
          title,
        })
        throw error
      }

      return {_id: handle.documentId}
    },
    [
      applyTaskActions,
      contentDataset,
      getTaskHandle,
      resolvedAuthorId,
      workspaceId,
      workspaceTitle,
    ],
  )

  const editTask = useCallback(
    async (taskId: string, payload: TaskEditPayload) => {
      const handle = getTaskHandle(taskId)
      const action = editTaskAction(handle, payload)

      console.debug('[useAddonTaskMutations] editTask:start', {
        action,
        handle,
        payload,
        runtime: mutationRuntime,
        taskId,
      })

      try {
        const result = await applyTaskActions(action)
        console.debug('[useAddonTaskMutations] editTask:success', {
          payload,
          result,
          runtime: mutationRuntime,
          taskId,
        })
        return result
      } catch (error) {
        console.error('[useAddonTaskMutations] editTask:failed', {
          action,
          error,
          handle,
          payload,
          runtime: mutationRuntime,
          taskId,
        })
        throw error
      }
    },
    [applyTaskActions, getTaskHandle, mutationRuntime],
  )

  const toggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: TaskStatus) => {
      const newStatus: TaskStatus = currentStatus === 'open' ? 'closed' : 'open'
      const handle = getTaskHandle(taskId)
      const action = setTaskStatusAction(handle, newStatus)

      console.debug('[useAddonTaskMutations] toggleTaskStatus:start', {
        action,
        currentStatus,
        handle,
        newStatus,
        runtime: mutationRuntime,
        taskId,
      })

      try {
        const result = await applyTaskActions(action)
        console.debug('[useAddonTaskMutations] toggleTaskStatus:success', {
          currentStatus,
          newStatus,
          result,
          runtime: mutationRuntime,
          taskId,
        })
        return result
      } catch (error) {
        console.error('[useAddonTaskMutations] toggleTaskStatus:failed', {
          action,
          currentStatus,
          error,
          handle,
          newStatus,
          runtime: mutationRuntime,
          taskId,
        })
        throw error
      }
    },
    [applyTaskActions, getTaskHandle, mutationRuntime],
  )

  const removeTask = useCallback(
    async (taskId: string) => {
      const handle = getTaskHandle(taskId)
      const action = deleteTaskAction(handle)

      console.debug('[useAddonTaskMutations] removeTask:start', {
        action,
        handle,
        runtime: mutationRuntime,
        taskId,
      })

      try {
        const result = await applyTaskActions(action)
        console.debug('[useAddonTaskMutations] removeTask:success', {
          result,
          runtime: mutationRuntime,
          taskId,
        })
        return result
      } catch (error) {
        console.error('[useAddonTaskMutations] removeTask:failed', {
          action,
          error,
          handle,
          runtime: mutationRuntime,
          taskId,
        })
        throw error
      }
    },
    [applyTaskActions, getTaskHandle, mutationRuntime],
  )

  const createCommentOnTask = useCallback(
    async (
      taskId: string,
      noteText: string,
      assignedTo?: string,
      _parentDocId?: string,
      _parentDocType?: string,
      documentTitle?: string,
    ) => {
      const children: Array<
        | {_key: string; _type: 'mention'; userId: string}
        | {_key: string; _type: 'span'; text: string}
      > = []

      if (assignedTo) {
        children.push({
          _key: crypto.randomUUID().slice(0, 8),
          _type: 'mention',
          userId: assignedTo,
        })
        children.push({
          _key: crypto.randomUUID().slice(0, 8),
          _type: 'span',
          text: ' ',
        })
      }

      children.push({
        _key: crypto.randomUUID().slice(0, 8),
        _type: 'span',
        text: noteText,
      })

      const message: AddonMessage = [
        {
          _key: crypto.randomUUID().slice(0, 8),
          _type: 'block',
          children,
          style: 'normal',
        },
      ]

      const commentId = crypto.randomUUID()
      const handle = getCommentHandle(commentId)
      const action = createTaskCommentAction(handle, {
        authorId: resolvedAuthorId,
        message,
        parentCommentId: undefined,
        subscribers: undefined,
        taskId,
        taskTitle: documentTitle ?? '',
        threadId: undefined,
        workspaceId,
        workspaceTitle,
      })

      console.debug('[useAddonTaskMutations] createCommentOnTask:start', {
        action,
        assignedTo,
        commentId,
        handle,
        noteText,
        runtime: mutationRuntime,
        taskId,
      })

      try {
        const result = await applyCommentActions(action)
        console.debug('[useAddonTaskMutations] createCommentOnTask:success', {
          commentId,
          result,
          runtime: mutationRuntime,
          taskId,
        })
      } catch (error) {
        console.error('[useAddonTaskMutations] createCommentOnTask:failed', {
          action,
          assignedTo,
          commentId,
          error,
          handle,
          noteText,
          runtime: mutationRuntime,
          taskId,
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

  return {createCommentOnTask, createTask, editTask, removeTask, toggleTaskStatus}
}
