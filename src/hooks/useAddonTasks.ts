import {useMemo} from 'react'

import {useAddonData} from '../context/AddonDataContext'
import type {TaskDocument} from '../types/addonTypes'

interface AddonTasksSummary {
  closedCount: number
  openCount: number
  overdueCount: number
  sortedTasks: TaskDocument[]
  tasks: TaskDocument[]
  unassignedCount: number
}

const EMPTY_TASK_SUMMARY: AddonTasksSummary = {
  closedCount: 0,
  openCount: 0,
  overdueCount: 0,
  sortedTasks: [],
  tasks: [],
  unassignedCount: 0,
}

export function useAddonTasks(documentId: string, _documentType?: string): AddonTasksSummary {
  const {tasksByDocId} = useAddonData()
  const cleanId = documentId.replace(/^drafts\./, '')

  return useMemo(() => {
    const tasks = tasksByDocId.get(cleanId) ?? []
    if (tasks.length === 0) return EMPTY_TASK_SUMMARY

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
      openCount,
      overdueCount,
      sortedTasks,
      tasks,
      unassignedCount,
    }
  }, [cleanId, tasksByDocId])
}

function isTaskOverdue(task: {dueBy?: string; status: string}) {
  if (task.status !== 'open' || !task.dueBy) return false
  return new Date(task.dueBy).getTime() < Date.now()
}
