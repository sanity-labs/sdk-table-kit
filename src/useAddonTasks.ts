import {useMemo} from 'react'

import {useAddonData} from './AddonDataContext'

export function useAddonTasks(documentId: string) {
  const {tasksByDocId} = useAddonData()
  const cleanId = documentId.replace('drafts.', '')
  const tasks = tasksByDocId.get(cleanId) ?? []

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

  return {
    closedCount,
    openCount,
    sortedTasks,
    tasks,
  }
}
