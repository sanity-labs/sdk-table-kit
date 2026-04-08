import {useClient} from '@sanity/sdk-react'
import {useCallback, useMemo} from 'react'

import {useAddonData} from '../context/AddonDataContext'
import {buildTaskCommentDocument, buildTaskStudioUrl} from '../helpers/comments/addonCommentUtils'
import type {
  AddonMessage,
  AddonTarget,
  TaskDocument,
  TaskEditPayload,
  TaskStatus,
} from '../types/addonTypes'
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
      const target = buildTarget(documentId, documentType)
      const docRef = documentId.replace('drafts.', '')
      const optimisticTaskId = `optimistic-task-${crypto.randomUUID()}`
      const optimisticTask: TaskDocument = {
        _createdAt: now,
        _id: optimisticTaskId,
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

      patchTasks(docRef, (tasks) => {
        if (tasks.some((task) => task._id === optimisticTaskId)) {
          return tasks
        }
        return [optimisticTask, ...tasks]
      })

      try {
        const createdTask = (await client.create({
          _type: 'tasks.task' as const,
          authorId,
          createdByUser: now,
          status: 'open',
          subscribers: assignedTo ? [authorId, assignedTo] : [authorId],
          target,
          title,
          ...(assignedTo ? {assignedTo} : {}),
          ...(dueBy ? {dueBy} : {}),
        })) as TaskDocument

        patchTasks(docRef, (tasks) => {
          const withoutOptimistic = tasks.filter((task) => task._id !== optimisticTaskId)
          if (withoutOptimistic.some((task) => task._id === createdTask._id)) {
            return withoutOptimistic
          }
          return [createdTask, ...withoutOptimistic]
        })

        return createdTask
      } catch (error) {
        patchTasks(docRef, (tasks) => tasks.filter((task) => task._id !== optimisticTaskId))
        console.error('[useAddonTaskMutations] createTask failed:', error)
        throw error
      }
    },
    [buildTarget, client, currentResourceUserId, patchTasks],
  )

  const editTask = useCallback(
    async (taskId: string, payload: TaskEditPayload) => {
      const docRef = findDocRefForTask(taskId)
      const now = new Date().toISOString()
      const patchPayload = {...payload, lastEditedAt: now}

      if (!docRef) {
        return await client.patch(taskId).set(patchPayload).commit()
      }

      const snapshot = snapshotTask(docRef, taskId)

      patchTasks(docRef, (tasks) =>
        tasks.map((task) =>
          task._id === taskId ? {...task, ...patchPayload, _updatedAt: now} : task,
        ),
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
      const now = new Date().toISOString()
      const patchPayload = {lastEditedAt: now, status: newStatus}

      if (!docRef) {
        return await client.patch(taskId).set(patchPayload).commit()
      }

      const snapshot = snapshotTask(docRef, taskId)

      patchTasks(docRef, (tasks) =>
        tasks.map((task) =>
          task._id === taskId ? {...task, ...patchPayload, _updatedAt: now} : task,
        ),
      )

      try {
        return await client.patch(taskId).set(patchPayload).commit()
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
      try {
        return await client.delete(taskId)
      } catch (error) {
        console.error(`[useAddonTaskMutations] removeTask failed (${taskId}):`, error)
        throw error
      }
    },
    [client],
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
      const docRef = findDocRefForTask(taskId)
      const taskSnapshot = docRef ? snapshotTask(docRef, taskId) : undefined

      await client.create(
        buildTaskCommentDocument({
          authorId: currentResourceUserId ?? 'unknown',
          commentId,
          message,
          subscribers: taskSnapshot?.subscribers,
          taskId,
          taskStudioUrl:
            taskSnapshot?.context?.notification?.url ??
            buildTaskStudioUrl(taskId, workspaceId, commentId),
          taskTitle: taskSnapshot?.title ?? documentTitle ?? '',
          workspaceId,
          workspaceTitle,
        }),
      )
    },
    [client, currentResourceUserId, findDocRefForTask, snapshotTask, workspaceId, workspaceTitle],
  )

  return {createCommentOnTask, createTask, editTask, removeTask, toggleTaskStatus}
}
