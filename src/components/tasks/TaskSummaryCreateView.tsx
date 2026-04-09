import {
  CalendarPopoverContent,
  formatDateOnlyString,
  parseDateOnlyString,
} from '@sanetti/sanity-table-kit'
import type {SanityUser} from '@sanity/sdk-react'
import {Button, Card, Flex, Popover, Stack, Text, useClickOutsideEvent} from '@sanity/ui'
import {Calendar, ChevronLeft, CircleDashed} from 'lucide-react'
import {useCallback, useEffect, useRef, useState} from 'react'
import {DayPicker} from 'react-day-picker'

import {buildMessageFromPlainText} from '../../helpers/comments/addonCommentUtils'
import {
  formatCompactDisplayName,
  formatDateValueForDisplay,
  fullWidthInputStyle,
  toDueDateIsoString,
} from '../../helpers/tasks/TaskSummaryUtils'
import {findUserByResourceUserId} from '../../helpers/users/addonUserUtils'
import {useAddonTaskMutations} from '../../hooks/useAddonTaskMutations'
import {TaskSummaryAssignPicker} from './TaskSummaryAssignPicker'
import {TaskListMetaPill, TaskMetadataChip, TaskUserAvatar} from './TaskSummaryShared'

export function TaskSummaryCreateView({
  documentId,
  documentType,
  onBack,
  onCreate,
  users,
}: {
  documentId: string
  documentType: string
  onBack: () => void
  onCreate: (taskId: string) => void
  users: SanityUser[]
}) {
  const {createTask} = useAddonTaskMutations()

  const [assignedToDraft, setAssignedToDraft] = useState<string | undefined>()
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [dueDateValue, setDueDateValue] = useState('')
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isDueDateEditorOpen, setIsDueDateEditorOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const assignButtonRef = useRef<HTMLButtonElement>(null)
  const assignPickerRef = useRef<HTMLDivElement>(null)
  const dueDateButtonRef = useRef<HTMLButtonElement>(null)
  const dueDateEditorRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)

  const assignee = assignedToDraft ? findUserByResourceUserId(assignedToDraft, users) : undefined
  const compactAssigneeName =
    formatCompactDisplayName(assignee?.profile?.displayName) ??
    assignee?.profile?.displayName ??
    'Unassigned'
  const canCreate = titleDraft.trim().length > 0 && !isCreating
  const selectedDueDate = parseDateOnlyString(dueDateValue || undefined)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const autoGrowDescription = useCallback(() => {
    const textarea = descriptionTextareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useEffect(() => {
    autoGrowDescription()
  }, [autoGrowDescription, descriptionDraft])

  useClickOutsideEvent(isAssignPickerOpen ? () => setIsAssignPickerOpen(false) : undefined, () => [
    assignButtonRef.current,
    assignPickerRef.current,
  ])

  useClickOutsideEvent(
    isDueDateEditorOpen ? () => setIsDueDateEditorOpen(false) : undefined,
    () => [dueDateButtonRef.current, dueDateEditorRef.current],
  )

  const handleBack = useCallback(() => {
    onBack()
  }, [onBack])

  const handleSelectDueDate = useCallback((date: Date | undefined) => {
    if (!date) return
    setDueDateValue(formatDateOnlyString(date))
    setIsDueDateEditorOpen(false)
  }, [])

  const handleCreate = useCallback(async () => {
    const trimmedTitle = titleDraft.trim()
    if (!canCreate || !trimmedTitle) return

    setIsCreating(true)
    try {
      const createdTask = await createTask(
        documentId,
        documentType,
        trimmedTitle,
        assignedToDraft,
        dueDateValue ? toDueDateIsoString(dueDateValue) : undefined,
        descriptionDraft.trim().length > 0
          ? buildMessageFromPlainText(descriptionDraft)
          : undefined,
      )

      onCreate(createdTask._id)
    } catch (error) {
      console.error('[TaskSummaryCreateView] create flow failed:', error)
    } finally {
      setIsCreating(false)
    }
  }, [
    assignedToDraft,
    canCreate,
    createTask,
    descriptionDraft,
    documentId,
    documentType,
    dueDateValue,
    onCreate,
    titleDraft,
  ])

  return (
    <Stack space={4}>
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={2} style={{flex: 1, minWidth: 0}}>
          <Button icon={<ChevronLeft size={16} />} mode="bleed" onClick={handleBack} padding={2} />
          <input
            autoFocus
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canCreate) {
                event.preventDefault()
                void handleCreate()
              }
            }}
            placeholder="Task title..."
            ref={titleInputRef}
            style={fullWidthInputStyle}
            value={titleDraft}
          />
        </Flex>
        <Button
          disabled={!canCreate}
          mode="ghost"
          onClick={() => {
            void handleCreate()
          }}
          text={isCreating ? 'Creating...' : 'Create task'}
          tone="primary"
        />
      </Flex>

      <Flex align="center" gap={2} style={{flexWrap: 'wrap'}}>
        <TaskListMetaPill>
          <Text size={1}>To Do</Text>
        </TaskListMetaPill>

        <div style={{position: 'relative'}}>
          <TaskMetadataChip
            onClick={() => setIsAssignPickerOpen((current) => !current)}
            ref={assignButtonRef}
          >
            {assignee ? <TaskUserAvatar user={assignee} /> : <CircleDashed size={12} />}
            <Text size={1}>{compactAssigneeName}</Text>
          </TaskMetadataChip>
          {isAssignPickerOpen && (
            <TaskSummaryAssignPicker
              currentAssignee={assignedToDraft}
              onAssign={(resourceUserId) => {
                setAssignedToDraft(resourceUserId)
                setIsAssignPickerOpen(false)
              }}
              pickerRef={assignPickerRef}
              users={users}
            />
          )}
        </div>

        <Popover
          animate
          content={
            <CalendarPopoverContent popoverRef={dueDateEditorRef}>
              <Stack space={3}>
                <DayPicker
                  defaultMonth={selectedDueDate}
                  mode="single"
                  onSelect={handleSelectDueDate}
                  selected={selectedDueDate}
                  showOutsideDays
                />
                <Flex justify="flex-end">
                  <Button
                    disabled={!dueDateValue}
                    fontSize={1}
                    mode="bleed"
                    onClick={() => {
                      setDueDateValue('')
                      setIsDueDateEditorOpen(false)
                    }}
                    text="Clear"
                  />
                </Flex>
              </Stack>
            </CalendarPopoverContent>
          }
          open={isDueDateEditorOpen}
          placement="bottom-start"
          portal
        >
          <TaskMetadataChip
            onClick={() => setIsDueDateEditorOpen((current) => !current)}
            ref={dueDateButtonRef}
          >
            <Calendar size={12} />
            <Text size={1}>{formatDateValueForDisplay(dueDateValue || undefined)}</Text>
          </TaskMetadataChip>
        </Popover>
      </Flex>

      <Card border padding={3} radius={2} tone="transparent">
        <Stack space={2}>
          <Text muted size={1}>
            Description
          </Text>
          <textarea
            onChange={(event) => setDescriptionDraft(event.target.value)}
            placeholder="Add a description..."
            ref={descriptionTextareaRef}
            rows={3}
            style={{
              ...fullWidthInputStyle,
              lineHeight: 1.4,
              minHeight: 88,
              overflow: 'hidden',
              resize: 'none',
            }}
            value={descriptionDraft}
          />
        </Stack>
      </Card>
    </Stack>
  )
}
