import type {SanityUser} from '@sanity/sdk-react'
import {Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {Calendar, ChevronDown, ChevronRight, CircleDashed} from 'lucide-react'

import {
  formatRelativeTime,
  getTaskDueDateLabel,
  isTaskOverdue,
  sectionToggleButtonStyle,
  taskRowButtonStyle,
} from '../../helpers/tasks/TaskSummaryUtils'
import {
  findUserByResourceUserId,
  getUserDisplayNameByResourceUserId,
} from '../../helpers/users/addonUserUtils'
import type {TaskDocument} from '../../types/addonTypes'
import {TaskListMetaPill, TaskSection, TaskUserAvatar} from './TaskSummaryShared'

export function TaskSummaryListView({
  doneExpanded,
  doneTasks,
  onSelectTask,
  onToggleDoneExpanded,
  openCount,
  openTasks,
  overdueTasks,
  users,
}: {
  doneExpanded: boolean
  doneTasks: TaskDocument[]
  onSelectTask: (taskId: string) => void
  onToggleDoneExpanded: () => void
  openCount: number
  openTasks: TaskDocument[]
  overdueTasks: TaskDocument[]
  users: SanityUser[]
}) {
  const showDoneSection = doneTasks.length > 0

  return (
    <Box style={{maxHeight: 420, overflowY: 'auto'}}>
      <Stack space={3}>
        {overdueTasks.length > 0 && (
          <TaskSection count={overdueTasks.length} title="OVERDUE" tone="critical">
            {overdueTasks.map((task) => (
              <TaskSummaryListItem
                key={task._id}
                onSelect={() => onSelectTask(task._id)}
                task={task}
                users={users}
              />
            ))}
          </TaskSection>
        )}

        {openTasks.length > 0 && (
          <TaskSection count={openTasks.length} title="OPEN">
            {openTasks.map((task) => (
              <TaskSummaryListItem
                key={task._id}
                onSelect={() => onSelectTask(task._id)}
                task={task}
                users={users}
              />
            ))}
          </TaskSection>
        )}

        {showDoneSection && (
          <Stack space={2}>
            <button
              onClick={onToggleDoneExpanded}
              style={sectionToggleButtonStyle(openCount > 0)}
              type="button"
            >
              {doneExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Text size={1} weight="semibold">
                Done ({doneTasks.length})
              </Text>
            </button>

            {doneExpanded && (
              <Stack space={2}>
                {doneTasks.map((task) => (
                  <TaskSummaryListItem
                    key={task._id}
                    onSelect={() => onSelectTask(task._id)}
                    task={task}
                    users={users}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
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
  const isClosed = task.status === 'closed'
  const isOverdue = isTaskOverdue(task)

  return (
    <button onClick={onSelect} style={taskRowButtonStyle} type="button">
      <Card border padding={2} radius={2} tone="transparent">
        <Stack space={2}>
          <Flex align="flex-start" justify="space-between" gap={2}>
            <Text
              size={1}
              weight="medium"
              style={{
                color: isClosed ? 'var(--card-muted-fg-color)' : undefined,
                flex: 1,
                minWidth: 0,
                textDecoration: isClosed ? 'line-through' : undefined,
              }}
            >
              {task.title}
            </Text>
            <Flex
              align="center"
              gap={1}
              style={{
                color: isOverdue ? 'var(--card-critical-fg-color)' : 'var(--card-muted-fg-color)',
              }}
            >
              <Calendar size={12} />
              <Text muted={!isOverdue} size={1} style={{color: isOverdue ? 'inherit' : undefined}}>
                {getTaskDueDateLabel(task) ?? 'No date'}
              </Text>
            </Flex>
          </Flex>

          <Flex align="center" gap={2} style={{flexWrap: 'wrap'}}>
            <TaskListMetaPill tone={isClosed ? 'default' : 'caution'}>
              <Text size={1}>{isClosed ? 'Done' : 'To Do'}</Text>
            </TaskListMetaPill>
            <TaskListMetaPill>
              {assignee ? <TaskUserAvatar user={assignee} /> : <CircleDashed size={12} />}
              <Text size={1}>{assigneeName ?? 'Unassigned'}</Text>
            </TaskListMetaPill>
            <Text muted size={1}>
              {formatRelativeTime(task._createdAt)}
            </Text>
          </Flex>
        </Stack>
      </Card>
    </button>
  )
}
