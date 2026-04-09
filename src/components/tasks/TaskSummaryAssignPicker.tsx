import {SearchIcon} from '@sanity/icons'
import type {SanityUser} from '@sanity/sdk-react'
import {Box, Button, Card, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {X} from 'lucide-react'
import {useMemo, useState} from 'react'

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
    <Card
      border
      radius={4}
      ref={pickerRef}
      shadow={2}
      style={{left: 0, marginTop: 6, position: 'absolute', top: '100%', width: 280, zIndex: 2}}
    >
      <Stack space={0}>
        <Box padding={2} style={{borderBottom: '1px solid var(--card-border-color)'}}>
          <TextInput
            autoFocus
            fontSize={1}
            icon={SearchIcon}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search people..."
            value={search}
          />
        </Box>

        <Box padding={2} style={{maxHeight: 220, overflowY: 'auto'}}>
          <Stack space={2}>
            {currentAssignee && (
              <Button
                fontSize={1}
                mode="ghost"
                onClick={() => onAssign(undefined)}
                padding={2}
                radius={2}
                style={{justifyContent: 'flex-start', width: '100%'}}
                tone="critical"
              >
                <Flex align="center" gap={2}>
                  <X size={14} />
                  <Text size={1}>Unassign</Text>
                </Flex>
              </Button>
            )}

            {filteredUsers.map(({resourceUserId, user}) => {
              const isCurrentAssignee = currentAssignee === resourceUserId
              const displayName = user.profile?.displayName ?? resourceUserId
              const email = user.profile?.email

              return (
                <Button
                  key={resourceUserId}
                  mode="ghost"
                  onClick={() => onAssign(resourceUserId)}
                  padding={2}
                  radius={2}
                  tone={isCurrentAssignee ? 'primary' : 'default'}
                >
                  <Flex align="center" gap={2} style={{width: '100%'}}>
                    <TaskUserAvatar user={user} />
                    <Box
                      style={{
                        display: 'flex',
                        flex: 1,
                        flexDirection: 'column',
                        gap: 4,
                        minWidth: 0,
                      }}
                    >
                      <Text
                        size={1}
                        style={{display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                        weight={isCurrentAssignee ? 'semibold' : 'regular'}
                      >
                        {displayName}
                      </Text>
                      {email && (
                        <Text
                          muted
                          size={0}
                          style={{display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                        >
                          {email}
                        </Text>
                      )}
                    </Box>
                    {isCurrentAssignee && (
                      <Text muted size={1}>
                        Assigned
                      </Text>
                    )}
                  </Flex>
                </Button>
              )
            })}

            {filteredUsers.length === 0 && (
              <Box padding={3}>
                <Text align="center" muted size={1}>
                  No users found
                </Text>
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>
    </Card>
  )
}
