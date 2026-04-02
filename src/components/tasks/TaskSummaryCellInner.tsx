import {AddIcon} from '@sanity/icons'
import {useUsers} from '@sanity/sdk-react'
import {
  Box,
  Card,
  Flex,
  Popover,
  Stack,
  Text,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

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

export function TaskSummaryCellInner({documentId, documentType}: TaskSummaryCellProps) {
  const {data: users = []} = useUsers()
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [isDoneExpanded, setIsDoneExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<null | string>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const {closedCount, openCount, overdueCount, tasks, unassignedCount} = useAddonTasks(documentId)

  const {doneTasks, openTasks, overdueTasks} = useMemo(() => {
    const overdue = tasks
      .filter((task) => isTaskOverdue(task))
      .sort((left, right) => compareOpenTasks(left, right))
    const openItems = tasks
      .filter((task) => task.status === 'open' && !isTaskOverdue(task))
      .sort((left, right) => compareOpenTasks(left, right))
    const done = tasks
      .filter((task) => task.status === 'closed')
      .sort(
        (left, right) => new Date(right._updatedAt).getTime() - new Date(left._updatedAt).getTime(),
      )

    return {doneTasks: done, openTasks: openItems, overdueTasks: overdue}
  }, [tasks])

  const selectedTask = selectedTaskId
    ? (tasks.find((task) => task._id === selectedTaskId) ?? null)
    : null

  const closePopover = useCallback(() => {
    setOpen(false)
    setSelectedTaskId(null)
  }, [])

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
      setSelectedTaskId(null)
      return
    }

    if (tasks.length === 0) {
      setIsAddFormOpen(true)
    }
  }, [open, tasks.length])

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task._id === selectedTaskId)) {
      setSelectedTaskId(null)
    }
  }, [selectedTaskId, tasks])

  const summary = getTaskSummary({
    closedCount,
    openCount,
    overdueCount,
    taskCount: tasks.length,
    unassignedCount,
  })
  const doneExpanded = (tasks.length > 0 && openCount === 0) || isDoneExpanded
  const headerSummary = tasks.length === 0 ? '0 tasks' : summary
  const showEmptyState = tasks.length === 0

  return (
    <Popover
      animate
      content={
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
            width: selectedTask
              ? 'min(520px, calc(100vw - 32px))'
              : 'min(380px, calc(100vw - 32px))',
          }}
        >
          {selectedTask ? (
            <TaskSummaryDetailView
              onBack={() => setSelectedTaskId(null)}
              task={selectedTask}
              users={users}
            />
          ) : (
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
                onOpen={() => setIsAddFormOpen(true)}
                onRequestClose={() => setIsAddFormOpen(false)}
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
                  onSelectTask={setSelectedTaskId}
                  onToggleDoneExpanded={() => {
                    if (openCount === 0) return
                    setIsDoneExpanded((current) => !current)
                  }}
                  openCount={openCount}
                  openTasks={openTasks}
                  overdueTasks={overdueTasks}
                  users={users}
                />
              )}
            </Stack>
          )}
        </Card>
      }
      open={open}
      placement="bottom-start"
      portal
      radius={2}
      shadow={3}
    >
      <div ref={triggerRef}>
        {showEmptyState ? (
          <Card
            border
            data-testid="task-empty-state"
            padding={1}
            radius={2}
            tone="transparent"
            style={{width: '100%'}}
          >
            <button
              onClick={(event) => {
                event.stopPropagation()
                setOpen((current) => !current)
              }}
              style={{
                alignItems: 'center',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                display: 'flex',
                gap: 8,
                padding: 8,
                width: '100%',
              }}
              type="button"
            >
              <Box style={addCircleStyle}>
                <AddIcon />
              </Box>
              <Text muted size={1}>
                Add task
              </Text>
            </button>
          </Card>
        ) : (
          <Box>
            <button
              onClick={(event) => {
                event.stopPropagation()
                setOpen((current) => !current)
              }}
              style={{
                background: 'transparent',
                border: 0,
                color: 'inherit',
                cursor: 'pointer',
                padding: 8,
              }}
              type="button"
            >
              <Text
                size={1}
                style={{
                  color: `var(--card-${getTaskSummaryTone({closedCount, openCount, overdueCount, unassignedCount})}-fg-color, inherit)`,
                }}
              >
                {summary}
              </Text>
            </button>
          </Box>
        )}
      </div>
    </Popover>
  )
}
