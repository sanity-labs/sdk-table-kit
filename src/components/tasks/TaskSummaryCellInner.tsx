import {TableCellChrome} from '@sanity-labs/react-table-kit'
import {AddIcon} from '@sanity/icons'
import {type SanityUser, useUsers} from '@sanity/sdk-react'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Popover,
  Stack,
  Text,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {useOptionalAddonData} from '../../context/AddonDataContext'
import {
  compareOpenTasks,
  getTaskSummaryFilterBadges,
  isTaskOverdue,
} from '../../helpers/tasks/TaskSummaryUtils'
import {useAddonTasks} from '../../hooks/useAddonTasks'
import {TaskSummaryEditorView} from './TaskSummaryEditorView'
import {TaskSummaryListView, type TaskListFilter} from './TaskSummaryListView'
import {addCircleStyle} from './TaskSummaryShared'

function TaskSummaryCellFilterBadgeButton({
  active,
  ariaLabel,
  count,
  label,
  onPress,
  tone,
}: {
  active: boolean
  ariaLabel: string
  count: number
  label: string
  onPress: () => void
  tone: 'caution' | 'critical' | 'default' | 'neutral' | 'positive' | 'primary'
}) {
  const [hover, setHover] = useState(false)

  return (
    <button
      aria-label={ariaLabel}
      onClick={onPress}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'transparent',
        border: 0,
        borderRadius: 999,
        cursor: 'pointer',
        filter: hover ? 'brightness(1.02)' : undefined,
        outline: active ? '2px solid var(--card-focus-ring-color, #556bfc)' : 'none',
        outlineOffset: 1,
        padding: 0,
        transition: 'filter 0.15s ease',
      }}
      type="button"
    >
      <Badge
        padding={2}
        tone={tone}
        style={{
          cursor: 'pointer',
        }}
      >
        {count} {label}
      </Badge>
    </button>
  )
}

export interface TaskSummaryCellProps {
  documentId: string
  documentType: string
}

interface TaskPopoverState {
  activeFilter: TaskListFilter
  isCreatingTask: boolean
  open: boolean
  selectedTaskId: null | string
}

const taskPopoverStateStore = new Map<string, TaskPopoverState>()

export function TaskSummaryCellInner({documentId, documentType}: TaskSummaryCellProps) {
  const stateKey = documentId.replace(/^drafts\./, '')
  const persistedState = taskPopoverStateStore.get(stateKey)
  const [activeFilter, setActiveFilter] = useState<TaskListFilter>(
    persistedState?.activeFilter ?? 'todo',
  )
  const [isCreatingTask, setIsCreatingTask] = useState(persistedState?.isCreatingTask ?? false)
  const [open, setOpen] = useState(persistedState?.open ?? false)
  const [selectedTaskId, setSelectedTaskId] = useState<null | string>(
    persistedState?.selectedTaskId ?? null,
  )
  const [optimisticallyRemovedTaskIds, setOptimisticallyRemovedTaskIds] = useState<Set<string>>(
    () => new Set(),
  )
  const popoverRef = useRef<HTMLDivElement>(null)
  const pendingFlushRef = useRef<null | (() => Promise<boolean>)>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const suppressCloseUntilRef = useRef(0)
  /** Newly materialized task id may not be in `tasks` until the addon syncs — don't clear selection meanwhile. */
  const pendingCreatedTaskIdRef = useRef<null | string>(null)
  const {isTasksLoading, tasks} = useAddonTasks(documentId, documentType)

  const visibleTasks = useMemo(
    () => tasks.filter((task) => !optimisticallyRemovedTaskIds.has(task._id)),
    [optimisticallyRemovedTaskIds, tasks],
  )
  const visibleTasksSignature = useMemo(
    () =>
      visibleTasks
        .map(
          (task) =>
            `${task._id}:${task._updatedAt}:${task.status}:${task.assignedTo ?? ''}:${task.dueBy ?? ''}:${task.title}`,
        )
        .join('|'),
    [visibleTasks],
  )
  const stableVisibleTasksRef = useRef<null | {
    signature: string
    tasks: typeof visibleTasks
  }>(null)
  const stableVisibleTasks = useMemo(() => {
    const cachedVisibleTasks = stableVisibleTasksRef.current
    if (cachedVisibleTasks && cachedVisibleTasks.signature === visibleTasksSignature) {
      return cachedVisibleTasks.tasks
    }

    stableVisibleTasksRef.current = {
      signature: visibleTasksSignature,
      tasks: visibleTasks,
    }
    return visibleTasks
  }, [visibleTasks, visibleTasksSignature])

  const {doneTasks, overdueTasks, todoTasks, unassignedTasks} = useMemo(() => {
    const overdue = stableVisibleTasks
      .filter((task) => isTaskOverdue(task))
      .sort((left, right) => compareOpenTasks(left, right))
    const todo = stableVisibleTasks
      .filter((task) => task.status === 'open' && !isTaskOverdue(task))
      .sort((left, right) => compareOpenTasks(left, right))
    const unassigned = todo.filter((task) => !task.assignedTo)
    const done = stableVisibleTasks
      .filter((task) => task.status === 'closed')
      .sort(
        (left, right) => new Date(right._updatedAt).getTime() - new Date(left._updatedAt).getTime(),
      )

    return {
      doneTasks: done,
      overdueTasks: overdue,
      todoTasks: todo,
      unassignedTasks: unassigned,
    }
  }, [stableVisibleTasks])

  const taskSummaryFilterBadges = useMemo(
    () =>
      getTaskSummaryFilterBadges({
        doneCount: doneTasks.length,
        overdueCount: overdueTasks.length,
        todoCount: todoTasks.length,
        unassignedCount: unassignedTasks.length,
      }),
    [doneTasks.length, overdueTasks.length, todoTasks.length, unassignedTasks.length],
  )

  const selectedTask = selectedTaskId
    ? (stableVisibleTasks.find((task) => task._id === selectedTaskId) ?? null)
    : null

  const filteredTasks = useMemo(() => {
    if (activeFilter === 'todo') return todoTasks
    if (activeFilter === 'unassigned') return unassignedTasks
    if (activeFilter === 'overdue') return overdueTasks
    return doneTasks
  }, [activeFilter, doneTasks, overdueTasks, todoTasks, unassignedTasks])

  const markInternalInteraction = useCallback((durationMs = 150) => {
    // Prevent outside-click close handlers from racing against internal click handlers.
    suppressCloseUntilRef.current = Date.now() + durationMs
  }, [])

  const hideTaskLocally = useCallback(
    (taskId: string) => {
      markInternalInteraction(3000)
      setOptimisticallyRemovedTaskIds((prev) => {
        if (prev.has(taskId)) return prev
        const next = new Set(prev)
        next.add(taskId)
        return next
      })
      setSelectedTaskId(null)
    },
    [markInternalInteraction],
  )

  const rollbackHiddenTask = useCallback((taskId: string) => {
    setOptimisticallyRemovedTaskIds((prev) => {
      if (!prev.has(taskId)) return prev
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }, [])

  const closePopoverWithoutGuard = useCallback(() => {
    setOpen(false)
    setIsCreatingTask(false)
    pendingFlushRef.current = null
    setOptimisticallyRemovedTaskIds((prev) => (prev.size === 0 ? prev : new Set()))
    setSelectedTaskId(null)
  }, [])

  const registerPendingFlush = useCallback((flushFn: null | (() => Promise<boolean>)) => {
    pendingFlushRef.current = flushFn
  }, [])

  const flushPendingWrites = useCallback(async () => {
    const flushFn = pendingFlushRef.current
    if (!flushFn) return true
    try {
      return await flushFn()
    } catch (error) {
      console.error('[TaskSummaryCellInner] flush failed before close:', error)
      return false
    }
  }, [])

  const closePopover = useCallback(async () => {
    if (Date.now() < suppressCloseUntilRef.current) {
      return
    }
    const canClose = await flushPendingWrites()
    if (!canClose) return
    closePopoverWithoutGuard()
  }, [closePopoverWithoutGuard, flushPendingWrites])

  useEffect(() => {
    const hasTransientState =
      open || isCreatingTask || selectedTaskId !== null || activeFilter !== 'todo'
    if (hasTransientState) {
      taskPopoverStateStore.set(stateKey, {
        activeFilter,
        isCreatingTask,
        open,
        selectedTaskId,
      })
      return
    }
    taskPopoverStateStore.delete(stateKey)
  }, [activeFilter, isCreatingTask, open, selectedTaskId, stateKey])

  useClickOutsideEvent(
    open
      ? () => {
          void closePopover()
        }
      : undefined,
    () => [popoverRef.current, triggerRef.current],
  )

  useGlobalKeyDown((event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()

    void (async () => {
      if (selectedTaskId) {
        markInternalInteraction()
        const canGoBack = await flushPendingWrites()
        if (!canGoBack) return
        setSelectedTaskId(null)
        return
      }

      if (isCreatingTask) {
        markInternalInteraction()
        const canLeaveCreate = await flushPendingWrites()
        if (!canLeaveCreate) return
        setIsCreatingTask(false)
        return
      }

      await closePopover()
    })()
  })

  useEffect(() => {
    if (!open) {
      setIsCreatingTask(false)
      pendingCreatedTaskIdRef.current = null
      pendingFlushRef.current = null
      setOptimisticallyRemovedTaskIds((prev) => (prev.size === 0 ? prev : new Set()))
      setSelectedTaskId(null)
      return
    }
  }, [open])

  useEffect(() => {
    if (!selectedTaskId) return
    if (stableVisibleTasks.some((task) => task._id === selectedTaskId)) {
      if (pendingCreatedTaskIdRef.current === selectedTaskId) {
        pendingCreatedTaskIdRef.current = null
      }
      return
    }
    if (pendingCreatedTaskIdRef.current === selectedTaskId) {
      return
    }
    setSelectedTaskId(null)
  }, [selectedTaskId, stableVisibleTasks])

  useEffect(() => {
    if (stableVisibleTasks.length === 0) return
    const countByFilter: Record<TaskListFilter, number> = {
      done: doneTasks.length,
      overdue: overdueTasks.length,
      todo: todoTasks.length,
      unassigned: unassignedTasks.length,
    }
    if (countByFilter[activeFilter] > 0) return
    const nextFilter = (['todo', 'unassigned', 'overdue', 'done'] as const).find(
      (filter) => countByFilter[filter] > 0,
    )
    if (nextFilter) setActiveFilter(nextFilter)
  }, [
    activeFilter,
    doneTasks.length,
    overdueTasks.length,
    stableVisibleTasks.length,
    todoTasks.length,
    unassignedTasks.length,
  ])

  const showEmptyState = stableVisibleTasks.length === 0
  const showEditorChrome = selectedTaskId !== null || isCreatingTask

  const handleBackFromDetail = useCallback(() => {
    markInternalInteraction()
    void (async () => {
      const canGoBack = await flushPendingWrites()
      if (!canGoBack) return
      setSelectedTaskId(null)
    })()
  }, [flushPendingWrites, markInternalInteraction])

  const handleStopCreate = useCallback(() => {
    markInternalInteraction()
    void (async () => {
      const canLeaveCreate = await flushPendingWrites()
      if (!canLeaveCreate) return
      setIsCreatingTask(false)
    })()
  }, [flushPendingWrites, markInternalInteraction])

  const handleSelectTask = useCallback(
    (taskId: null | string) => {
      markInternalInteraction()
      setSelectedTaskId(taskId)
    },
    [markInternalInteraction],
  )

  const handleStartCreate = useCallback(() => {
    markInternalInteraction()
    setIsCreatingTask(true)
    setSelectedTaskId(null)
  }, [markInternalInteraction])

  const handleCreateComplete = useCallback(
    (taskId: string) => {
      markInternalInteraction(3000)
      pendingCreatedTaskIdRef.current = taskId
      setIsCreatingTask(false)
      setSelectedTaskId(taskId)
    },
    [markInternalInteraction],
  )
  const handleTriggerPress = useCallback(() => {
    if (open) {
      void closePopover()
      return
    }
    markInternalInteraction()
    setOpen(true)
    if (stableVisibleTasks.length === 0) {
      setIsCreatingTask(true)
      setSelectedTaskId(null)
    }
  }, [closePopover, markInternalInteraction, open, stableVisibleTasks.length])

  const handleOpenTasksWithFilter = useCallback(
    (filter: TaskListFilter) => {
      markInternalInteraction()
      setActiveFilter(filter)
      setIsCreatingTask(false)
      setSelectedTaskId(null)
      setOpen(true)
    },
    [markInternalInteraction],
  )

  const popoverContent = useMemo(
    () => (
      <Card
        padding={3}
        radius={2}
        ref={popoverRef}
        shadow={2}
        style={{
          maxWidth: showEditorChrome
            ? 'min(520px, calc(100vw - 32px))'
            : 'min(420px, calc(100vw - 32px))',
          minWidth: showEditorChrome ? 420 : 340,
          width: showEditorChrome
            ? 'min(520px, calc(100vw - 32px))'
            : 'min(420px, calc(100vw - 32px))',
        }}
      >
        <Suspense
          fallback={
            <Card border padding={3} radius={2} tone="transparent">
              <Text muted size={1}>
                Loading…
              </Text>
            </Card>
          }
        >
          <TaskSummaryPopoverBody
            activeFilter={activeFilter}
            documentId={documentId}
            documentType={documentType}
            doneCount={doneTasks.length}
            filteredTasks={filteredTasks}
            isCreatingTask={isCreatingTask}
            isTasksLoading={isTasksLoading}
            onBackFromDetail={handleBackFromDetail}
            onCreateComplete={handleCreateComplete}
            onDeleteOptimistic={hideTaskLocally}
            onDeleteRollback={rollbackHiddenTask}
            onFilterChange={setActiveFilter}
            onInternalInteraction={markInternalInteraction}
            onRegisterFlushPending={registerPendingFlush}
            onSelectTask={handleSelectTask}
            onStartCreate={handleStartCreate}
            onStopCreate={handleStopCreate}
            overdueCount={overdueTasks.length}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            todoCount={todoTasks.length}
            unassignedCount={unassignedTasks.length}
          />
        </Suspense>
      </Card>
    ),
    [
      activeFilter,
      documentId,
      documentType,
      doneTasks.length,
      filteredTasks,
      handleBackFromDetail,
      handleCreateComplete,
      handleSelectTask,
      handleStartCreate,
      handleStopCreate,
      hideTaskLocally,
      isCreatingTask,
      isTasksLoading,
      markInternalInteraction,
      overdueTasks.length,
      registerPendingFlush,
      rollbackHiddenTask,
      selectedTask,
      selectedTaskId,
      showEditorChrome,
      todoTasks.length,
      unassignedTasks.length,
    ],
  )

  return (
    <Popover
      animate
      content={popoverContent}
      open={open}
      placement="bottom-start"
      portal
      radius={2}
      shadow={3}
    >
      <div ref={triggerRef} style={{width: '100%'}}>
        <div
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {showEmptyState ? (
            <TableCellChrome
              dataTestId="task-empty-state"
              leading={
                <div style={addCircleStyle}>
                  <AddIcon />
                </div>
              }
              onPress={handleTriggerPress}
              state="empty"
              title={
                <Text muted size={1}>
                  Add task
                </Text>
              }
            />
          ) : (
            <Box data-testid="task-summary-state" style={{width: '100%'}}>
              <Flex align="center" gap={2} style={{flexWrap: 'wrap'}}>
                {taskSummaryFilterBadges
                  .filter((row) => row.count > 0)
                  .map((row) => {
                    const isActive = open && activeFilter === row.key
                    return (
                      <TaskSummaryCellFilterBadgeButton
                        active={isActive}
                        ariaLabel={`${row.count} ${row.label}. Open tasks.`}
                        count={row.count}
                        key={row.key}
                        label={row.label}
                        onPress={() => handleOpenTasksWithFilter(row.key)}
                        tone={row.tone}
                      />
                    )
                  })}
              </Flex>
            </Box>
          )}
        </div>
      </div>
    </Popover>
  )
}

function TaskSummaryPopoverBody({
  activeFilter,
  documentId,
  documentType,
  doneCount,
  filteredTasks,
  isCreatingTask,
  isTasksLoading,
  onBackFromDetail,
  onCreateComplete,
  onDeleteOptimistic,
  onDeleteRollback,
  onFilterChange,
  onInternalInteraction,
  onRegisterFlushPending,
  onSelectTask,
  onStartCreate,
  onStopCreate,
  overdueCount,
  selectedTask,
  selectedTaskId,
  todoCount,
  unassignedCount,
}: {
  activeFilter: TaskListFilter
  documentId: string
  documentType: string
  doneCount: number
  filteredTasks: ReturnType<typeof useAddonTasks>['tasks']
  isCreatingTask: boolean
  isTasksLoading: boolean
  onBackFromDetail: () => void
  onCreateComplete: (taskId: string) => void
  onDeleteOptimistic: (taskId: string) => void
  onDeleteRollback: (taskId: string) => void
  onFilterChange: (filter: TaskListFilter) => void
  onInternalInteraction: (durationMs?: number) => void
  onRegisterFlushPending: (flushFn: null | (() => Promise<boolean>)) => void
  onSelectTask: (taskId: null | string) => void
  onStartCreate: () => void
  onStopCreate: () => void
  overdueCount: number
  selectedTask: null | ReturnType<typeof useAddonTasks>['tasks'][number]
  selectedTaskId: null | string
  todoCount: number
  unassignedCount: number
}) {
  const addonData = useOptionalAddonData()
  const seededUsers = addonData?.users

  if (seededUsers) {
    return (
      <TaskSummaryPopoverBodyContent
        activeFilter={activeFilter}
        documentId={documentId}
        documentType={documentType}
        doneCount={doneCount}
        filteredTasks={filteredTasks}
        isCreatingTask={isCreatingTask}
        isTasksLoading={isTasksLoading}
        onBackFromDetail={onBackFromDetail}
        onCreateComplete={onCreateComplete}
        onDeleteOptimistic={onDeleteOptimistic}
        onDeleteRollback={onDeleteRollback}
        onFilterChange={onFilterChange}
        onInternalInteraction={onInternalInteraction}
        onRegisterFlushPending={onRegisterFlushPending}
        onSelectTask={onSelectTask}
        onStartCreate={onStartCreate}
        onStopCreate={onStopCreate}
        overdueCount={overdueCount}
        selectedTask={selectedTask}
        selectedTaskId={selectedTaskId}
        todoCount={todoCount}
        unassignedCount={unassignedCount}
        users={seededUsers}
      />
    )
  }

  return (
    <TaskSummaryPopoverBodyWithUsersQuery
      activeFilter={activeFilter}
      documentId={documentId}
      documentType={documentType}
      doneCount={doneCount}
      filteredTasks={filteredTasks}
      isCreatingTask={isCreatingTask}
      isTasksLoading={isTasksLoading}
      onBackFromDetail={onBackFromDetail}
      onCreateComplete={onCreateComplete}
      onDeleteOptimistic={onDeleteOptimistic}
      onDeleteRollback={onDeleteRollback}
      onFilterChange={onFilterChange}
      onInternalInteraction={onInternalInteraction}
      onRegisterFlushPending={onRegisterFlushPending}
      onSelectTask={onSelectTask}
      onStartCreate={onStartCreate}
      onStopCreate={onStopCreate}
      overdueCount={overdueCount}
      selectedTask={selectedTask}
      selectedTaskId={selectedTaskId}
      todoCount={todoCount}
      unassignedCount={unassignedCount}
    />
  )
}

function TaskSummaryPopoverBodyWithUsersQuery(
  props: Omit<Parameters<typeof TaskSummaryPopoverBodyContent>[0], 'users'>,
) {
  const {data: users = []} = useUsers()

  return <TaskSummaryPopoverBodyContent {...props} users={users} />
}

function TaskSummaryPopoverBodyContent({
  activeFilter,
  documentId,
  documentType,
  doneCount,
  filteredTasks,
  isCreatingTask,
  isTasksLoading,
  onBackFromDetail,
  onCreateComplete,
  onDeleteOptimistic,
  onDeleteRollback,
  onFilterChange,
  onInternalInteraction,
  onRegisterFlushPending,
  onSelectTask,
  onStartCreate,
  onStopCreate,
  overdueCount,
  selectedTask,
  selectedTaskId,
  todoCount,
  unassignedCount,
  users,
}: {
  activeFilter: TaskListFilter
  documentId: string
  documentType: string
  doneCount: number
  filteredTasks: ReturnType<typeof useAddonTasks>['tasks']
  isCreatingTask: boolean
  isTasksLoading: boolean
  onBackFromDetail: () => void
  onCreateComplete: (taskId: string) => void
  onDeleteOptimistic: (taskId: string) => void
  onDeleteRollback: (taskId: string) => void
  onFilterChange: (filter: TaskListFilter) => void
  onInternalInteraction: (durationMs?: number) => void
  onRegisterFlushPending: (flushFn: null | (() => Promise<boolean>)) => void
  onSelectTask: (taskId: null | string) => void
  onStartCreate: () => void
  onStopCreate: () => void
  overdueCount: number
  selectedTask: null | ReturnType<typeof useAddonTasks>['tasks'][number]
  selectedTaskId: null | string
  todoCount: number
  unassignedCount: number
  users: SanityUser[]
}) {
  if (selectedTaskId !== null || isCreatingTask) {
    return (
      <TaskSummaryEditorView
        documentId={documentId}
        documentType={documentType}
        onBack={selectedTaskId !== null ? onBackFromDetail : onStopCreate}
        onDeleteOptimistic={onDeleteOptimistic}
        onDeleteRollback={onDeleteRollback}
        onInternalInteraction={onInternalInteraction}
        onRegisterFlushPending={onRegisterFlushPending}
        onTaskMaterialized={onCreateComplete}
        task={selectedTask ?? undefined}
        users={users}
      />
    )
  }

  return (
    <Stack space={4}>
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={2}>
          {/* <Button
            icon={<ChevronLeft size={16} />}
            mode="bleed"
            onClick={onClosePopover}
            padding={2}
          /> */}
          <Heading size={2} weight="semibold">
            Tasks
          </Heading>
        </Flex>
        <Button icon={AddIcon} mode="ghost" onClick={onStartCreate} text="Add task" />
      </Flex>

      <TaskSummaryListView
        activeFilter={activeFilter}
        doneCount={doneCount}
        isTasksLoading={isTasksLoading}
        onFilterChange={onFilterChange}
        onSelectTask={(taskId) => onSelectTask(taskId)}
        overdueCount={overdueCount}
        tasks={filteredTasks}
        todoCount={todoCount}
        unassignedCount={unassignedCount}
        users={users}
      />
    </Stack>
  )
}
