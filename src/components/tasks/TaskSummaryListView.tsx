import type {SanityUser} from '@sanity/sdk-react'
import {Badge, Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {Calendar, CircleDashed, MessageSquare} from 'lucide-react'

import {toPlainText} from '../../helpers/comments/addonCommentUtils'
import {
  formatCompactDisplayName,
  getTaskDueDateLabel,
  isTaskOverdue,
} from '../../helpers/tasks/TaskSummaryUtils'
import {
  findUserByResourceUserId,
  getUserDisplayNameByResourceUserId,
} from '../../helpers/users/addonUserUtils'
import {useTaskComments} from '../../hooks/useTaskComments'
import type {TaskDocument} from '../../types/addonTypes'
import {TaskListMetaPill, TaskUserAvatar} from './TaskSummaryShared'

export type TaskListFilter = 'done' | 'overdue' | 'todo' | 'unassigned'

export function TaskSummaryListView({
  activeFilter,
  doneCount,
  onFilterChange,
  onSelectTask,
  overdueCount,
  tasks,
  todoCount,
  unassignedCount,
  users,
}: {
  activeFilter: TaskListFilter
  doneCount: number
  onFilterChange: (filter: TaskListFilter) => void
  onSelectTask: (taskId: string) => void
  overdueCount: number
  tasks: TaskDocument[]
  todoCount: number
  unassignedCount: number
  users: SanityUser[]
}) {
  const filters: Array<{
    count: number
    key: TaskListFilter
    label: string
    tone: 'critical' | 'default' | 'positive' | 'caution' | 'primary' | 'neutral'
  }> = [
    {count: todoCount, key: 'todo', label: 'Todo', tone: 'neutral'},
    {count: unassignedCount, key: 'unassigned', label: 'Unassigned', tone: 'caution'},
    {count: overdueCount, key: 'overdue', label: 'Overdue', tone: 'critical'},
    {count: doneCount, key: 'done', label: 'Done', tone: 'positive'},
  ]

  return (
    <Stack space={3}>
      <Flex align="center" gap={2} style={{flexWrap: 'wrap'}}>
        {filters.map((filter) => {
          const disabled = filter.count === 0
          const isActive = activeFilter === filter.key

          return (
            <button
              disabled={disabled}
              key={filter.key}
              onClick={() => {
                if (disabled) return
                onFilterChange(filter.key)
              }}
              style={{
                background: 'transparent',
                border: 0,
                borderRadius: 999,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.55 : 1,
                outline: isActive ? '2px solid var(--card-focus-ring-color, #556bfc)' : 'none',
                outlineOffset: 1,
                padding: 0,
              }}
              type="button"
            >
              <Badge padding={2} tone={filter.tone}>
                {filter.count} {filter.label}
              </Badge>
            </button>
          )
        })}
      </Flex>

      <Box style={{maxHeight: 420, overflowY: 'auto'}}>
        {tasks.length === 0 ? (
          <Card border padding={3} radius={2} tone="transparent">
            <Text muted size={1}>
              No tasks in this filter.
            </Text>
          </Card>
        ) : (
          <Stack space={2}>
            {tasks.map((task) => (
              <TaskSummaryListItem
                key={task._id}
                onSelect={() => onSelectTask(task._id)}
                task={task}
                users={users}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  )
}

function TaskSummaryListItem({
  onSelect,
  task,
  users,
}: {
  onSelect: () => void
  task: TaskDocument
  users: SanityUser[]
}) {
  const assignee = task.assignedTo ? findUserByResourceUserId(task.assignedTo, users) : undefined
  const assigneeName = getUserDisplayNameByResourceUserId(task.assignedTo, users)
  const compactAssigneeName =
    formatCompactDisplayName(assigneeName ?? undefined) ?? assigneeName ?? 'Unassigned'
  const isClosed = task.status === 'closed'
  const isOverdue = isTaskOverdue(task)
  const taskCommentsState = useTaskComments(task._id)
  const commentsCount = taskCommentsState.comments?.length ?? 0
  const description = task.description ? toPlainText(task.description).trim() : ''
  const hasDescription = description.length > 0

  return (
    <Button mode="ghost" onClick={onSelect} padding={3} radius={2} tone="default">
      <Stack space={3}>
        <Text
          size={2}
          weight="semibold"
          style={{
            color: isClosed ? 'var(--card-muted-fg-color)' : undefined,
            minWidth: 0,
            textDecoration: isClosed ? 'line-through' : undefined,
          }}
        >
          {task.title}
        </Text>

        {hasDescription && (
          <Text
            muted
            size={1}
            style={{
              whiteSpace: 'normal',
            }}
          >
            {description}
          </Text>
        )}

        <Flex align="center" gap={2} style={{flexWrap: 'wrap'}}>
          <TaskListMetaPill>
            {assignee ? <TaskUserAvatar user={assignee} /> : <CircleDashed size={12} />}
            <Text size={1}>{compactAssigneeName}</Text>
          </TaskListMetaPill>
          <TaskListMetaPill tone={isOverdue ? 'critical' : 'default'}>
            <Calendar size={12} />
            <Text size={1}>{getTaskDueDateLabel(task) ?? 'No date'}</Text>
          </TaskListMetaPill>
          {commentsCount > 0 && (
            <TaskListMetaPill tone="neutral">
              <MessageSquare size={12} />
              <Text size={1}>
                {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
              </Text>
            </TaskListMetaPill>
          )}
        </Flex>
      </Stack>
    </Button>
  )
}
