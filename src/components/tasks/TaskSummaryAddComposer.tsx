import {AddIcon} from '@sanity/icons'
import type {SanityUser} from '@sanity/sdk-react'
import {Box, Button, Card, Flex, Stack, Text, useClickOutsideEvent} from '@sanity/ui'
import {CircleDashed} from 'lucide-react'
import {useCallback, useRef, useState} from 'react'

import {fullWidthInputStyle} from '../../helpers/tasks/TaskSummaryUtils'
import {findUserByResourceUserId} from '../../helpers/users/addonUserUtils'
import {useAddonTaskMutations} from '../../hooks/useAddonTaskMutations'
import {TaskSummaryAssignPicker} from './TaskSummaryAssignPicker'
import {TaskMetadataChip, TaskUserAvatar} from './TaskSummaryShared'

export function TaskSummaryAddComposer({
  documentId,
  documentType,
  isOpen,
  onOpen,
  onRequestClose,
  users,
}: {
  documentId: string
  documentType: string
  isOpen: boolean
  onOpen: () => void
  onRequestClose: () => void
  users: SanityUser[]
}) {
  const {createTask} = useAddonTaskMutations()
  const [assignedTo, setAssignedTo] = useState<string | undefined>()
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const assignButtonRef = useRef<HTMLButtonElement>(null)
  const assignPickerRef = useRef<HTMLDivElement>(null)
  const assignee = assignedTo ? findUserByResourceUserId(assignedTo, users) : undefined

  useClickOutsideEvent(isAssignPickerOpen ? () => setIsAssignPickerOpen(false) : undefined, () => [
    assignButtonRef.current,
    assignPickerRef.current,
  ])

  const resetForm = useCallback(() => {
    setAssignedTo(undefined)
    setIsAssignPickerOpen(false)
    setTitle('')
  }, [])

  const handleSubmit = useCallback(() => {
    const nextTitle = title.trim()
    if (!nextTitle) return

    createTask(documentId, documentType, nextTitle, assignedTo).catch(() => {})
    resetForm()
  }, [assignedTo, createTask, documentId, documentType, resetForm, title])

  if (!isOpen) {
    return (
      <Box>
        <Button fontSize={1} icon={AddIcon} mode="ghost" onClick={onOpen} text="Add task" />
      </Box>
    )
  }

  return (
    <Card border padding={2} radius={2} tone="transparent">
      <Stack space={2}>
        <input
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit()
            if (event.key === 'Escape') {
              resetForm()
              onRequestClose()
            }
          }}
          placeholder="Task title..."
          style={fullWidthInputStyle}
          value={title}
        />

        <Flex align="center" justify="space-between" gap={2}>
          <Box style={{position: 'relative'}}>
            <TaskMetadataChip
              onClick={() => setIsAssignPickerOpen((current) => !current)}
              ref={assignButtonRef}
            >
              {assignee ? <TaskUserAvatar user={assignee} /> : <CircleDashed size={12} />}
              <Text size={1}>{assignee?.profile?.displayName ?? 'Unassigned'}</Text>
            </TaskMetadataChip>

            {isAssignPickerOpen && (
              <TaskSummaryAssignPicker
                currentAssignee={assignedTo}
                onAssign={(resourceUserId) => {
                  setAssignedTo(resourceUserId)
                  setIsAssignPickerOpen(false)
                }}
                pickerRef={assignPickerRef}
                users={users}
              />
            )}
          </Box>

          <Flex align="center" gap={2}>
            <Button
              disabled={!title.trim()}
              fontSize={1}
              mode="ghost"
              onClick={handleSubmit}
              text="Create"
              tone="primary"
            />
            <Button
              fontSize={1}
              mode="bleed"
              onClick={() => {
                resetForm()
                onRequestClose()
              }}
              text="Cancel"
            />
          </Flex>
        </Flex>
      </Stack>
    </Card>
  )
}
