import {useMemo} from 'react'

import {useAddonData} from '../context/AddonDataContext'
import type {TaskDocument} from '../types/addonTypes'

export interface AddonTasksSummary {
  closedCount: number
  isTasksLoading: boolean
  openCount: number
  overdueCount: number
  sortedTasks: TaskDocument[]
  tasks: TaskDocument[]
  unassignedCount: number
}

const EMPTY_TASK_SUMMARY: Omit<AddonTasksSummary, 'isTasksLoading'> = {
  closedCount: 0,
  openCount: 0,
  overdueCount: 0,
  sortedTasks: [],
  tasks: [],
  unassignedCount: 0,
}

export function useAddonTasks(documentId: string, _documentType?: string): AddonTasksSummary {
  const {isLoading, tasksByDocId} = useAddonData()
  const cleanId = documentId.replace(/^drafts\./, '')

  return useMemo(() => {
    const tasks = tasksByDocId.get(cleanId) ?? []
    const isTasksLoading = tasks.length === 0 && isLoading

    if (tasks.length === 0) {
      return {
        ...EMPTY_TASK_SUMMARY,
        isTasksLoading,
      }
    }

    const sortedTasks = [...tasks].sort((left, right) => {
      if (left.status !== right.status) return left.status === 'open' ? -1 : 1
      return new Date(right._createdAt).getTime() - new Date(left._createdAt).getTime()
    })

    const openCount = tasks.filter((task) => task.status === 'open').length
    const closedCount = tasks.length - openCount
    const overdueCount = tasks.filter((task) => isTaskOverdue(task)).length
    const unassignedCount = tasks.filter(
      (task) => task.status === 'open' && !task.assignedTo && !isTaskOverdue(task),
    ).length

    return {
      closedCount,
      isTasksLoading: false,
      openCount,
      overdueCount,
      sortedTasks,
      tasks,
      unassignedCount,
    }
  }, [cleanId, isLoading, tasksByDocId])
}

function isTaskOverdue(task: {dueBy?: string; status: string}) {
  if (task.status !== 'open' || !task.dueBy) return false
  return new Date(task.dueBy).getTime() < Date.now()
}
