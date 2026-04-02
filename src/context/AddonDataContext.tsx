import {useQuery} from '@sanity/sdk-react'
import React, {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {AddonDataContextValue, TaskDocument} from '../types/addonTypes'

const TASKS_BY_DOC_TYPE_QUERY = `*[
  _type == "tasks.task"
  && target.documentType == $docType
]{
  _id,
  _type,
  _createdAt,
  _updatedAt,
  title,
  status,
  authorId,
  assignedTo,
  dueBy,
  description,
  context,
  subscribers,
  lastEditedAt,
  createdByUser,
  target
} | order(_createdAt desc)`

const AddonDataCtx = createContext<AddonDataContextValue | null>(null)

interface AddonDataProviderProps {
  addonDataset: string
  children: ReactNode
  contentDataset?: string
  docType: string
  projectId: string
  workspaceId?: string
  workspaceTitle?: string
}

class AddonErrorBoundaryInner extends React.Component<
  {children: ReactNode; fallback: ReactNode},
  {error: Error | null}
> {
  state = {error: null as Error | null}

  static getDerivedStateFromError(error: Error) {
    return {error}
  }

  componentDidCatch(error: Error) {
    console.error('[AddonErrorBoundary] caught error:', error.message, error)
  }

  render() {
    if (this.state.error) {
      return this.props.fallback
    }

    return this.props.children
  }
}

export function AddonDataProvider({
  addonDataset,
  children,
  contentDataset,
  docType,
  projectId,
  workspaceId,
  workspaceTitle,
}: AddonDataProviderProps) {
  const [tasksByDocId, setTasksByDocId] = useState<Map<string, TaskDocument[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  const handleTasks = useCallback((tasks: null | TaskDocument[]) => {
    const map = new Map<string, TaskDocument[]>()

    if (tasks) {
      for (const task of tasks) {
        const docRef = task.target?.document?._ref
        if (!docRef) continue

        const existing = map.get(docRef)
        if (existing) {
          existing.push(task)
        } else {
          map.set(docRef, [task])
        }
      }
    }

    setTasksByDocId(map)
    setIsLoading(false)
  }, [])

  const patchTasks = useCallback(
    (docRef: string, updater: (tasks: TaskDocument[]) => TaskDocument[]) => {
      setTasksByDocId((prev) => {
        const next = new Map(prev)
        const current = next.get(docRef) ?? []
        const updated = updater(current)

        if (updated.length > 0) {
          next.set(docRef, updated)
        } else {
          next.delete(docRef)
        }

        return next
      })
    },
    [],
  )

  const value = useMemo<AddonDataContextValue>(
    () => ({
      addonDataset,
      contentDataset,
      isLoading,
      patchTasks,
      projectId,
      tasksByDocId,
      workspaceId,
      workspaceTitle,
    }),
    [
      addonDataset,
      contentDataset,
      isLoading,
      patchTasks,
      projectId,
      tasksByDocId,
      workspaceId,
      workspaceTitle,
    ],
  )

  return (
    <AddonDataCtx.Provider value={value}>
      <AddonErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <TasksFetchBridge
            addonDataset={addonDataset}
            docType={docType}
            onTasks={handleTasks}
            projectId={projectId}
          />
        </Suspense>
      </AddonErrorBoundary>
      {children}
    </AddonDataCtx.Provider>
  )
}

export function useAddonData(): AddonDataContextValue {
  const ctx = useContext(AddonDataCtx)
  if (!ctx) {
    throw new Error('useAddonData must be used inside <AddonDataProvider>')
  }

  return ctx
}

export function useOptionalAddonData(): AddonDataContextValue | null {
  return useContext(AddonDataCtx)
}

function AddonErrorBoundary({children, fallback}: {children: ReactNode; fallback: ReactNode}) {
  return <AddonErrorBoundaryInner fallback={fallback}>{children}</AddonErrorBoundaryInner>
}

function TasksFetchBridge({
  addonDataset,
  docType,
  onTasks,
  projectId,
}: {
  addonDataset: string
  docType: string
  onTasks: (tasks: null | TaskDocument[]) => void
  projectId: string
}) {
  const {data: tasks} = useQuery<TaskDocument[]>({
    dataset: addonDataset,
    params: {docType},
    projectId,
    query: TASKS_BY_DOC_TYPE_QUERY,
  })

  useEffect(() => {
    onTasks(tasks ?? null)
  }, [tasks, onTasks])

  return null
}
