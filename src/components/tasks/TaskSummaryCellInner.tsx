import {TableCellChrome} from '@sanetti/sanity-table-kit'
import {AddIcon} from '@sanity/icons'
import {type SanityUser, useUsers} from '@sanity/sdk-react'
import {Card, Flex, Popover, Stack, Text, useClickOutsideEvent, useGlobalKeyDown} from '@sanity/ui'
import {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {useOptionalAddonData} from '../../context/AddonDataContext'
import {
  compareOpenTasks,
  getTaskSummary,
  getTaskSummaryTone,
  isTaskOverdue,
} from '../../helpers/tasks/TaskSummaryUtils'
import {useAddonTasks} from '../../hooks/useAddonTasks'
import {TaskSummaryAddComposer} from './TaskSummaryAddComposer'
import {TaskSummaryDetailView} from './TaskSummaryDetailView'
import {TaskSummaryListView} from './TaskSummaryListView'
import {addCircleStyle} from './TaskSummaryShared'

export interface TaskSummaryCellProps {
  documentId: string
  documentType: string
}

interface TaskPopoverState {
  isAddFormOpen: boolean
  isDoneExpanded: boolean
  open: boolean
  selectedTaskId: null | string
}

const taskPopoverStateStore = new Map<string, TaskPopoverState>()

export function TaskSummaryCellInner({documentId, documentType}: TaskSummaryCellProps) {
  const stateKey = documentId.replace(/^drafts\./, '')
  const persistedState = taskPopoverStateStore.get(stateKey)
  const [isAddFormOpen, setIsAddFormOpen] = useState(persistedState?.isAddFormOpen ?? false)
  const [isDoneExpanded, setIsDoneExpanded] = useState(persistedState?.isDoneExpanded ?? false)
  const [open, setOpen] = useState(persistedState?.open ?? false)
  const [selectedTaskId, setSelectedTaskId] = useState<null | string>(
    persistedState?.selectedTaskId ?? null,
  )
  const [optimisticallyRemovedTaskIds, setOptimisticallyRemovedTaskIds] = useState<Set<string>>(
    () => new Set(),
  )
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const suppressCloseUntilRef = useRef(0)
  const {tasks} = useAddonTasks(documentId)

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
  const stableVisibleTasksRef = useRef<null | {signature: string; tasks: typeof visibleTasks}>(null)
  const stableVisibleTasks = useMemo(() => {
    if (stableVisibleTasksRef.current?.signature === visibleTasksSignature) {
      return stableVisibleTasksRef.current.tasks
    }

    stableVisibleTasksRef.current = {signature: visibleTasksSignature, tasks: visibleTasks}
    return visibleTasks
  }, [visibleTasks, visibleTasksSignature])

  const {closedCount, openCount, overdueCount, unassignedCount} = useMemo(() => {
    const open = stableVisibleTasks.filter((task) => task.status === 'open').length
    const closed = stableVisibleTasks.length - open
    const overdue = stableVisibleTasks.filter((task) => isTaskOverdue(task)).length
    const unassigned = stableVisibleTasks.filter(
      (task) => task.status === 'open' && !task.assignedTo && !isTaskOverdue(task),
    ).length
    return {
      closedCount: closed,
      openCount: open,
      overdueCount: overdue,
      unassignedCount: unassigned,
    }
  }, [stableVisibleTasks])

  const {doneTasks, openTasks, overdueTasks} = useMemo(() => {
    const overdue = stableVisibleTasks
      .filter((task) => isTaskOverdue(task))
      .sort((left, right) => compareOpenTasks(left, right))
    const openItems = stableVisibleTasks
      .filter((task) => task.status === 'open' && !isTaskOverdue(task))
      .sort((left, right) => compareOpenTasks(left, right))
    const done = stableVisibleTasks
      .filter((task) => task.status === 'closed')
      .sort(
        (left, right) => new Date(right._updatedAt).getTime() - new Date(left._updatedAt).getTime(),
      )

    return {doneTasks: done, openTasks: openItems, overdueTasks: overdue}
  }, [stableVisibleTasks])

  const selectedTask = selectedTaskId
    ? (stableVisibleTasks.find((task) => task._id === selectedTaskId) ?? null)
    : null

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

  const closePopover = useCallback(() => {
    if (Date.now() < suppressCloseUntilRef.current) {
      return
    }
    setOpen(false)
    setIsAddFormOpen(false)
    setOptimisticallyRemovedTaskIds((prev) => (prev.size === 0 ? prev : new Set()))
    setSelectedTaskId(null)
  }, [])

  useEffect(() => {
    const hasTransientState = open || isAddFormOpen || isDoneExpanded || selectedTaskId !== null
    if (hasTransientState) {
      taskPopoverStateStore.set(stateKey, {isAddFormOpen, isDoneExpanded, open, selectedTaskId})
      return
    }
    taskPopoverStateStore.delete(stateKey)
  }, [isAddFormOpen, isDoneExpanded, open, selectedTaskId, stateKey])

  useClickOutsideEvent(open ? closePopover : undefined, () => [
    popoverRef.current,
    triggerRef.current,
  ])

  useGlobalKeyDown((event) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()

    if (selectedTaskId) {
      setSelectedTaskId(null)
      return
    }

    closePopover()
  })

  useEffect(() => {
    if (!open) {
      setIsAddFormOpen(false)
      setOptimisticallyRemovedTaskIds((prev) => (prev.size === 0 ? prev : new Set()))
      setSelectedTaskId(null)
      return
    }

    if (tasks.length === 0) {
      setIsAddFormOpen(true)
    }
  }, [open, tasks.length])

  useEffect(() => {
    if (selectedTaskId && !stableVisibleTasks.some((task) => task._id === selectedTaskId)) {
      setSelectedTaskId(null)
    }
  }, [selectedTaskId, stableVisibleTasks])

  const summary = getTaskSummary({
    closedCount,
    openCount,
    overdueCount,
    taskCount: stableVisibleTasks.length,
    unassignedCount,
  })
  const doneExpanded = (stableVisibleTasks.length > 0 && openCount === 0) || isDoneExpanded
  const headerSummary = stableVisibleTasks.length === 0 ? '0 tasks' : summary
  const showEmptyState = stableVisibleTasks.length === 0
  const handleOpenAddForm = useCallback(() => {
    markInternalInteraction()
    setIsAddFormOpen(true)
  }, [markInternalInteraction])
  const handleRequestCloseAddForm = useCallback(() => {
    markInternalInteraction()
    setIsAddFormOpen(false)
  }, [markInternalInteraction])
  const handleSelectTask = useCallback(
    (taskId: null | string) => {
      markInternalInteraction()
      setSelectedTaskId(taskId)
    },
    [markInternalInteraction],
  )
  const handleToggleDoneExpanded = useCallback(() => {
    markInternalInteraction()
    if (openCount === 0) return
    setIsDoneExpanded((current) => !current)
  }, [markInternalInteraction, openCount])
  const handleBackFromDetail = useCallback(() => {
    markInternalInteraction()
    setSelectedTaskId(null)
  }, [markInternalInteraction])

  const popoverContent = useMemo(
    () => (
      <Card
        padding={3}
        radius={2}
        ref={popoverRef}
        shadow={2}
        style={{
          maxWidth: selectedTask
            ? 'min(520px, calc(100vw - 32px))'
            : 'min(380px, calc(100vw - 32px))',
          minWidth: selectedTask ? 420 : 300,
          width: selectedTask ? 'min(520px, calc(100vw - 32px))' : 'min(380px, calc(100vw - 32px))',
        }}
      >
        <Suspense
          fallback={
            <Card border padding={3} radius={2} tone="transparent">
              <Text muted size={1}>
                Loading tasks...
              </Text>
            </Card>
          }
        >
          <TaskSummaryPopoverBody
            documentId={documentId}
            documentType={documentType}
            doneExpanded={doneExpanded}
            doneTasks={doneTasks}
            headerSummary={headerSummary}
            isAddFormOpen={isAddFormOpen}
            onInternalInteraction={markInternalInteraction}
            onDeleteOptimistic={hideTaskLocally}
            onDeleteRollback={rollbackHiddenTask}
            onOpenAddForm={handleOpenAddForm}
            onRequestCloseAddForm={handleRequestCloseAddForm}
            onSelectTask={handleSelectTask}
            onToggleDoneExpanded={handleToggleDoneExpanded}
            openCount={openCount}
            openTasks={openTasks}
            overdueTasks={overdueTasks}
            selectedTask={selectedTask}
            showEmptyState={showEmptyState}
            onBackFromDetail={handleBackFromDetail}
          />
        </Suspense>
      </Card>
    ),
    [
      documentId,
      documentType,
      doneExpanded,
      doneTasks,
      handleBackFromDetail,
      handleOpenAddForm,
      handleRequestCloseAddForm,
      handleSelectTask,
      handleToggleDoneExpanded,
      headerSummary,
      hideTaskLocally,
      isAddFormOpen,
      markInternalInteraction,
      openCount,
      openTasks,
      overdueTasks,
      rollbackHiddenTask,
      selectedTask,
      showEmptyState,
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
          <TableCellChrome
            dataTestId={showEmptyState ? 'task-empty-state' : 'task-summary-state'}
            leading={
              showEmptyState ? (
                <div style={addCircleStyle}>
                  <AddIcon />
                </div>
              ) : undefined
            }
            onPress={() => setOpen((current) => !current)}
            state={showEmptyState ? 'empty' : 'filled'}
            title={
              showEmptyState ? (
                <Text muted size={1}>
                  Add task
                </Text>
              ) : (
                <Text
                  size={1}
                  style={{
                    color: `var(--card-${getTaskSummaryTone({closedCount, openCount, overdueCount, unassignedCount})}-fg-color, inherit)`,
                  }}
                >
                  {summary}
                </Text>
              )
            }
          />
        </div>
      </div>
    </Popover>
  )
}

function TaskSummaryPopoverBody({
  documentId,
  documentType,
  doneExpanded,
  doneTasks,
  headerSummary,
  isAddFormOpen,
  onInternalInteraction,
  onDeleteOptimistic,
  onDeleteRollback,
  onOpenAddForm,
  onRequestCloseAddForm,
  onSelectTask,
  onToggleDoneExpanded,
  openCount,
  openTasks,
  overdueTasks,
  selectedTask,
  showEmptyState,
  onBackFromDetail,
}: {
  documentId: string
  documentType: string
  doneExpanded: boolean
  doneTasks: ReturnType<typeof useAddonTasks>['tasks']
  headerSummary: string
  isAddFormOpen: boolean
  onInternalInteraction: (durationMs?: number) => void
  onDeleteOptimistic: (taskId: string) => void
  onDeleteRollback: (taskId: string) => void
  onOpenAddForm: () => void
  onRequestCloseAddForm: () => void
  onSelectTask: (taskId: null | string) => void
  onToggleDoneExpanded: () => void
  openCount: number
  openTasks: ReturnType<typeof useAddonTasks>['tasks']
  overdueTasks: ReturnType<typeof useAddonTasks>['tasks']
  selectedTask: null | ReturnType<typeof useAddonTasks>['tasks'][number]
  showEmptyState: boolean
  onBackFromDetail: () => void
}) {
  const addonData = useOptionalAddonData()
  const seededUsers = addonData?.users

  if (seededUsers) {
    return (
      <TaskSummaryPopoverBodyContent
        documentId={documentId}
        documentType={documentType}
        doneExpanded={doneExpanded}
        doneTasks={doneTasks}
        headerSummary={headerSummary}
        isAddFormOpen={isAddFormOpen}
        onInternalInteraction={onInternalInteraction}
        onDeleteOptimistic={onDeleteOptimistic}
        onDeleteRollback={onDeleteRollback}
        onBackFromDetail={onBackFromDetail}
        onOpenAddForm={onOpenAddForm}
        onRequestCloseAddForm={onRequestCloseAddForm}
        onSelectTask={onSelectTask}
        onToggleDoneExpanded={onToggleDoneExpanded}
        openCount={openCount}
        openTasks={openTasks}
        overdueTasks={overdueTasks}
        selectedTask={selectedTask}
        showEmptyState={showEmptyState}
        users={seededUsers}
      />
    )
  }

  return (
    <TaskSummaryPopoverBodyWithUsersQuery
      documentId={documentId}
      documentType={documentType}
      doneExpanded={doneExpanded}
      doneTasks={doneTasks}
      headerSummary={headerSummary}
      isAddFormOpen={isAddFormOpen}
      onInternalInteraction={onInternalInteraction}
      onDeleteOptimistic={onDeleteOptimistic}
      onDeleteRollback={onDeleteRollback}
      onBackFromDetail={onBackFromDetail}
      onOpenAddForm={onOpenAddForm}
      onRequestCloseAddForm={onRequestCloseAddForm}
      onSelectTask={onSelectTask}
      onToggleDoneExpanded={onToggleDoneExpanded}
      openCount={openCount}
      openTasks={openTasks}
      overdueTasks={overdueTasks}
      selectedTask={selectedTask}
      showEmptyState={showEmptyState}
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
  documentId,
  documentType,
  doneExpanded,
  doneTasks,
  headerSummary,
  isAddFormOpen,
  onInternalInteraction,
  onDeleteOptimistic,
  onDeleteRollback,
  onOpenAddForm,
  onRequestCloseAddForm,
  onSelectTask,
  onToggleDoneExpanded,
  openCount,
  openTasks,
  overdueTasks,
  selectedTask,
  showEmptyState,
  onBackFromDetail,
  users,
}: {
  documentId: string
  documentType: string
  doneExpanded: boolean
  doneTasks: ReturnType<typeof useAddonTasks>['tasks']
  headerSummary: string
  isAddFormOpen: boolean
  onInternalInteraction: (durationMs?: number) => void
  onDeleteOptimistic: (taskId: string) => void
  onDeleteRollback: (taskId: string) => void
  onOpenAddForm: () => void
  onRequestCloseAddForm: () => void
  onSelectTask: (taskId: null | string) => void
  onToggleDoneExpanded: () => void
  openCount: number
  openTasks: ReturnType<typeof useAddonTasks>['tasks']
  overdueTasks: ReturnType<typeof useAddonTasks>['tasks']
  selectedTask: null | ReturnType<typeof useAddonTasks>['tasks'][number]
  showEmptyState: boolean
  onBackFromDetail: () => void
  users: SanityUser[]
}) {
  if (selectedTask) {
    return (
      <TaskSummaryDetailView
        onBack={onBackFromDetail}
        onInternalInteraction={onInternalInteraction}
        onDeleteOptimistic={onDeleteOptimistic}
        onDeleteRollback={onDeleteRollback}
        task={selectedTask}
        users={users}
      />
    )
  }

  return (
    <Stack space={3}>
      <Flex align="center" justify="space-between">
        <Text size={1} weight="semibold">
          Tasks
        </Text>
        <Text muted size={1}>
          {headerSummary}
        </Text>
      </Flex>

      <TaskSummaryAddComposer
        documentId={documentId}
        documentType={documentType}
        isOpen={isAddFormOpen}
        onOpen={onOpenAddForm}
        onRequestClose={onRequestCloseAddForm}
        users={users}
      />

      {showEmptyState ? (
        <Card border padding={3} radius={2} tone="transparent">
          <Text muted size={1}>
            No tasks yet.
          </Text>
        </Card>
      ) : (
        <TaskSummaryListView
          doneExpanded={doneExpanded}
          doneTasks={doneTasks}
          onSelectTask={onSelectTask}
          onToggleDoneExpanded={onToggleDoneExpanded}
          openCount={openCount}
          openTasks={openTasks}
          overdueTasks={overdueTasks}
          users={users}
        />
      )}
    </Stack>
  )
}
