import {useClient} from '@sanity/sdk-react'
import {useCallback, useMemo} from 'react'

import {buildStudioUrl} from './addonCommentUtils'
import {useAddonData} from './AddonDataContext'
import type {
  AddonMessage,
  AddonTarget,
  TaskDocument,
  TaskEditPayload,
  TaskStatus,
} from './addonTypes'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

export function useAddonTaskMutations() {
  const {
    addonDataset,
    contentDataset,
    patchTasks,
    projectId,
    tasksByDocId,
    workspaceId,
    workspaceTitle,
  } = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId()
  const baseClient = useClient({apiVersion: '2025-05-06'})

  const client = useMemo(
    () =>
      baseClient.withConfig({
        dataset: addonDataset,
        projectId,
      }),
    [addonDataset, baseClient, projectId],
  )

  const buildTarget = useCallback(
    (documentId: string, documentType: string): AddonTarget => {
      if (!contentDataset) {
        throw new Error('Addon content dataset is not configured')
      }

      return {
        document: {
          _dataset: contentDataset,
          _projectId: projectId,
          _ref: documentId.replace('drafts.', ''),
          _type: 'crossDatasetReference',
          _weak: true,
        },
        documentType,
      }
    },
    [contentDataset, projectId],
  )

  const findDocRefForTask = useCallback(
    (taskId: string): string | undefined => {
      for (const [docRef, tasks] of tasksByDocId) {
        if (tasks.some((task) => task._id === taskId)) return docRef
      }

      return undefined
    },
    [tasksByDocId],
  )

  const snapshotTask = useCallback(
    (docRef: string, taskId: string): TaskDocument | undefined => {
      return tasksByDocId.get(docRef)?.find((task) => task._id === taskId)
    },
    [tasksByDocId],
  )

  const createTask = useCallback(
    async (
      documentId: string,
      documentType: string,
      title: string,
      assignedTo?: string,
      dueBy?: string,
    ) => {
      const authorId = currentResourceUserId ?? 'unknown'
      const now = new Date().toISOString()
      const docRef = documentId.replace('drafts.', '')
      const tempId = `optimistic-${crypto.randomUUID()}`
      const target = buildTarget(documentId, documentType)

      const optimisticTask: TaskDocument = {
        _createdAt: now,
        _id: tempId,
        _type: 'tasks.task',
        _updatedAt: now,
        authorId,
        createdByUser: now,
        status: 'open',
        subscribers: assignedTo ? [authorId, assignedTo] : [authorId],
        target,
        title,
        ...(assignedTo ? {assignedTo} : {}),
        ...(dueBy ? {dueBy} : {}),
      }

      patchTasks(docRef, (tasks) => [optimisticTask, ...tasks])

      try {
        const result = await client.create({
          _type: 'tasks.task' as const,
          authorId,
          createdByUser: now,
          status: 'open',
          subscribers: assignedTo ? [authorId, assignedTo] : [authorId],
          target,
          title,
          ...(assignedTo ? {assignedTo} : {}),
          ...(dueBy ? {dueBy} : {}),
        })

        patchTasks(docRef, (tasks) =>
          tasks.map((task) => (task._id === tempId ? {...task, _id: result._id} : task)),
        )

        return result
      } catch (error) {
        patchTasks(docRef, (tasks) => tasks.filter((task) => task._id !== tempId))
        console.error('[useAddonTaskMutations] createTask failed:', error)
        throw error
      }
    },
    [buildTarget, client, currentResourceUserId, patchTasks],
  )

  const editTask = useCallback(
    async (taskId: string, payload: TaskEditPayload) => {
      const docRef = findDocRefForTask(taskId)
      const patchPayload = {...payload, lastEditedAt: new Date().toISOString()}

      if (!docRef) {
        return await client.patch(taskId).set(patchPayload).commit()
      }

      const snapshot = snapshotTask(docRef, taskId)

      patchTasks(docRef, (tasks) =>
        tasks.map((task) => (task._id === taskId ? {...task, ...patchPayload} : task)),
      )

      try {
        return await client.patch(taskId).set(patchPayload).commit()
      } catch (error) {
        if (snapshot) {
          patchTasks(docRef, (tasks) =>
            tasks.map((task) => (task._id === taskId ? snapshot : task)),
          )
        }
        console.error(`[useAddonTaskMutations] editTask failed (${taskId}):`, error)
        throw error
      }
    },
    [client, findDocRefForTask, patchTasks, snapshotTask],
  )

  const toggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: TaskStatus) => {
      const newStatus: TaskStatus = currentStatus === 'open' ? 'closed' : 'open'
      const docRef = findDocRefForTask(taskId)

      if (!docRef) {
        return await client.patch(taskId).set({status: newStatus}).commit()
      }

      const snapshot = snapshotTask(docRef, taskId)

      patchTasks(docRef, (tasks) =>
        tasks.map((task) => (task._id === taskId ? {...task, status: newStatus} : task)),
      )

      try {
        return await client.patch(taskId).set({status: newStatus}).commit()
      } catch (error) {
        if (snapshot) {
          patchTasks(docRef, (tasks) =>
            tasks.map((task) => (task._id === taskId ? snapshot : task)),
          )
        }
        console.error(`[useAddonTaskMutations] toggleTaskStatus failed (${taskId}):`, error)
        throw error
      }
    },
    [client, findDocRefForTask, patchTasks, snapshotTask],
  )

  const removeTask = useCallback(
    async (taskId: string) => {
      const docRef = findDocRefForTask(taskId)

      if (!docRef) {
        return await client.delete(taskId)
      }

      const snapshot = snapshotTask(docRef, taskId)
      patchTasks(docRef, (tasks) => tasks.filter((task) => task._id !== taskId))

      try {
        return await client.delete(taskId)
      } catch (error) {
        if (snapshot) {
          patchTasks(docRef, (tasks) => [...tasks, snapshot])
        }
        console.error(`[useAddonTaskMutations] removeTask failed (${taskId}):`, error)
        throw error
      }
    },
    [client, findDocRefForTask, patchTasks, snapshotTask],
  )

  const createCommentOnTask = useCallback(
    async (
      taskId: string,
      noteText: string,
      assignedTo?: string,
      parentDocId?: string,
      parentDocType?: string,
      documentTitle?: string,
    ) => {
      if (!contentDataset) {
        throw new Error('Addon content dataset is not configured')
      }

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

      await client.create({
        _id: commentId,
        _type: 'comment',
        authorId: currentResourceUserId ?? 'unknown',
        context: {
          notification: {
            currentThreadLength: 1,
            documentTitle: documentTitle ?? '',
            url:
              parentDocId && parentDocType
                ? buildStudioUrl(parentDocId, parentDocType, commentId, workspaceId)
                : '',
            workspaceName: workspaceId ?? '',
            workspaceTitle: workspaceTitle ?? '',
          },
          payload: {
            workspace: workspaceId ?? '',
          },
          tool: '',
        },
        message,
        status: 'open',
        target: {
          document: {
            _dataset: contentDataset,
            _projectId: projectId,
            _ref: taskId,
            _type: 'crossDatasetReference',
            _weak: true,
          },
          documentType: 'tasks.task',
          path: {field: 'description'},
        },
        threadId: commentId,
      })
    },
    [client, contentDataset, currentResourceUserId, projectId, workspaceId, workspaceTitle],
  )

  return {createCommentOnTask, createTask, editTask, removeTask, toggleTaskStatus}
}
