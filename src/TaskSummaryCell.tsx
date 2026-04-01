import {useUsers} from '@sanity/sdk-react'
import {Badge, Box, Button, Card, Flex, Popover, Stack, Text} from '@sanity/ui'
import React, {useState} from 'react'

import {useOptionalAddonData} from './AddonDataContext'
import {getUserDisplayNameByResourceUserId} from './addonUserUtils'
import {useAddonTasks} from './useAddonTasks'

interface TaskSummaryCellProps {
  documentId: string
}

export function TaskSummaryCell({documentId}: TaskSummaryCellProps) {
  const addonData = useOptionalAddonData()

  if (!addonData) {
    return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
  }

  return <TaskSummaryCellInner documentId={documentId} />
}

function TaskSummaryCellInner({documentId}: TaskSummaryCellProps) {
  const {data: users = []} = useUsers()
  const [open, setOpen] = useState(false)
  const {closedCount, openCount, sortedTasks, tasks} = useAddonTasks(documentId)

  if (tasks.length === 0) {
    return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
  }

  const summary = `${openCount} open${closedCount > 0 ? ` · ${closedCount} closed` : ''}`

  return (
    <Popover
      animate
      content={
        <Card padding={3} radius={2} shadow={2} style={{maxWidth: 320, minWidth: 260}}>
          <Stack space={3}>
            <Flex align="center" justify="space-between">
              <Text size={1} weight="semibold">
                Tasks
              </Text>
              <Text muted size={1}>
                {summary}
              </Text>
            </Flex>
            <Stack space={2}>
              {sortedTasks.map((task) => {
                const assigneeName = getUserDisplayNameByResourceUserId(task.assignedTo, users)

                return (
                  <Card key={task._id} padding={2} radius={2} tone="transparent" border>
                    <Stack space={2}>
                      <Flex align="center" gap={2}>
                        <Badge
                          mode="outline"
                          tone={task.status === 'open' ? 'caution' : 'positive'}
                        >
                          {task.status === 'open' ? 'Open' : 'Closed'}
                        </Badge>
                        {task.dueBy && (
                          <Text muted size={1}>
                            Due {new Date(task.dueBy).toLocaleDateString()}
                          </Text>
                        )}
                      </Flex>
                      <Text size={1} weight="medium">
                        {task.title}
                      </Text>
                      <Flex align="center" justify="space-between">
                        <Text muted size={1}>
                          {assigneeName ?? 'Unassigned'}
                        </Text>
                        <Text muted size={1}>
                          {new Date(task._createdAt).toLocaleDateString()}
                        </Text>
                      </Flex>
                    </Stack>
                  </Card>
                )
              })}
            </Stack>
          </Stack>
        </Card>
      }
      open={open}
      placement="bottom-start"
      portal
      radius={2}
      shadow={3}
    >
      <Box>
        <Button
          fontSize={1}
          mode="bleed"
          onClick={(event) => {
            event.stopPropagation()
            setOpen((current) => !current)
          }}
          padding={2}
          text={summary}
          tone={openCount > 0 ? 'caution' : 'default'}
        />
      </Box>
    </Popover>
  )
}
