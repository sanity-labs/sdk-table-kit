import {SearchIcon} from '@sanity/icons'
import type {SanityUser} from '@sanity/sdk-react'
import {Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {X} from 'lucide-react'
import {useMemo, useState} from 'react'

import {
  assignPickerStyle,
  searchInputStyle,
  taskAssignOptionButtonStyle,
} from '../../helpers/tasks/TaskSummaryUtils'
import {getResourceUserId} from '../../helpers/users/addonUserUtils'
import {TaskUserAvatar} from './TaskSummaryShared'

export function TaskSummaryAssignPicker({
  currentAssignee,
  onAssign,
  pickerRef,
  users,
}: {
  currentAssignee?: string
  onAssign: (resourceUserId: string | undefined) => void
  pickerRef: React.RefObject<HTMLDivElement | null>
  users: SanityUser[]
}) {
  const [search, setSearch] = useState('')

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const projectUsers = users
      .map((user) => ({resourceUserId: getResourceUserId(user), user}))
      .filter((entry): entry is {resourceUserId: string; user: SanityUser} =>
        Boolean(entry.resourceUserId),
      )

    if (!query) return projectUsers

    return projectUsers.filter(({user}) => {
      const displayName = user.profile?.displayName?.toLowerCase() ?? ''
      const email = user.profile?.email?.toLowerCase() ?? ''
      return displayName.includes(query) || email.includes(query)
    })
  }, [search, users])

  return (
    <Card border padding={2} radius={2} ref={pickerRef} shadow={2} style={assignPickerStyle}>
      <Stack space={2}>
        <Flex align="center" gap={2}>
          <SearchIcon />
          <input
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people..."
            style={searchInputStyle}
            value={search}
          />
        </Flex>

        {currentAssignee && (
          <button
            onClick={() => onAssign(undefined)}
            style={taskAssignOptionButtonStyle}
            type="button"
          >
            <X size={14} />
            <Text size={1}>Unassign</Text>
          </button>
        )}

        {filteredUsers.map(({resourceUserId, user}) => (
          <button
            key={resourceUserId}
            onClick={() => onAssign(resourceUserId)}
            style={taskAssignOptionButtonStyle}
            type="button"
          >
            <TaskUserAvatar user={user} />
            <Box style={{flex: 1, minWidth: 0}}>
              <Text size={1}>{user.profile?.displayName ?? resourceUserId}</Text>
            </Box>
            {currentAssignee === resourceUserId && (
              <Text muted size={1}>
                Assigned
              </Text>
            )}
          </button>
        ))}

        {filteredUsers.length === 0 && (
          <Text muted size={1}>
            No users found
          </Text>
        )}
      </Stack>
    </Card>
  )
}
