import {useMemo} from 'react'

import {useAddonData} from '../context/AddonDataContext'

export function useAddonTasks(documentId: string) {
  const {tasksByDocId} = useAddonData()
  const cleanId = documentId.replace('drafts.', '')
  const tasks = useMemo(() => tasksByDocId.get(cleanId) ?? [], [cleanId, tasksByDocId])

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1
        return new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime()
      }),
    [tasks],
  )

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
}

function isTaskOverdue(task: {dueBy?: string; status: string}) {
  if (task.status !== 'open' || !task.dueBy) return false
  return new Date(task.dueBy).getTime() < Date.now()
}
