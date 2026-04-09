import {
  CalendarPopoverContent,
  formatDateOnlyString,
  parseDateOnlyString,
} from '@sanetti/sanity-table-kit'
import type {SanityUser} from '@sanity/sdk-react'
import {Box, Button, Card, Flex, Popover, Stack, Text, useClickOutsideEvent} from '@sanity/ui'
import {Bell, BellOff, Calendar, ChevronLeft, CircleDashed} from 'lucide-react'
import {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {DayPicker} from 'react-day-picker'

import {useAddonData} from '../../context/AddonDataContext'
import {
  buildMessageFromPlainText,
  buildTaskCommentDocument,
  toPlainText,
} from '../../helpers/comments/addonCommentUtils'
import {
  formatCompactDisplayName,
  formatDateValueForDisplay,
  getDateInputValue,
  getStudioTaskUrl,
  isDateValueOverdue,
  fullWidthInputStyle,
  toDueDateIsoString,
} from '../../helpers/tasks/TaskSummaryUtils'
import {findUserByResourceUserId} from '../../helpers/users/addonUserUtils'
import {useAddonTaskMutations} from '../../hooks/useAddonTaskMutations'
import {useCurrentResourceUserId} from '../../hooks/useCurrentResourceUserId'
import {useSafeToast} from '../../hooks/useSafeToast'
import {useTaskCommentMutations} from '../../hooks/useTaskCommentMutations'
import {useTaskComments} from '../../hooks/useTaskComments'
import type {TaskDocument} from '../../types/addonTypes'
import {SharedCommentsPanel, type SharedCommentsAdapter} from '../comments/SharedCommentsPanel'
import {TaskSummaryAssignPicker} from './TaskSummaryAssignPicker'
import {TaskActionsMenu, TaskMetadataChip, TaskUserAvatar} from './TaskSummaryShared'

const TEXT_AUTOSAVE_DEBOUNCE_MS = 350

export function TaskSummaryDetailView({
  onDeleteOptimistic,
  onDeleteRollback,
  onInternalInteraction,
  onBack,
  onRegisterFlushPending,
  task,
  users,
}: {
  onDeleteOptimistic?: (taskId: string) => void
  onDeleteRollback?: (taskId: string) => void
  onInternalInteraction?: (durationMs?: number) => void
  onBack: () => void
  onRegisterFlushPending?: (flushFn: null | (() => Promise<boolean>)) => void
  task: TaskDocument
  users: SanityUser[]
}) {
  const {workspaceId, workspaceTitle} = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId()
  const {editTask, removeTask, toggleTaskStatus} = useAddonTaskMutations()
  const toast = useSafeToast()

  const [assignedToDraft, setAssignedToDraft] = useState<string | undefined>(task.assignedTo)
  const [descriptionDraft, setDescriptionDraft] = useState(() =>
    toPlainText(task.description ?? []).trim(),
  )
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false)
  const [isDueDateEditorOpen, setIsDueDateEditorOpen] = useState(false)
  const [isSavingDescription, setIsSavingDescription] = useState(false)
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [titleValidationMessage, setTitleValidationMessage] = useState<null | string>(null)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [dueDateValue, setDueDateValue] = useState(() => getDateInputValue(task.dueBy))

  const assignButtonRef = useRef<HTMLButtonElement>(null)
  const assignPickerRef = useRef<HTMLDivElement>(null)
  const dueDateButtonRef = useRef<HTMLButtonElement>(null)
  const dueDateEditorRef = useRef<HTMLDivElement>(null)
  const titleAutosaveTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null)
  const descriptionAutosaveTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null)
  const inFlightSavesRef = useRef<{
    description: null | Promise<boolean>
    title: null | Promise<boolean>
  }>({
    description: null,
    title: null,
  })
  const latestDraftRef = useRef({
    description: toPlainText(task.description ?? []).trim(),
    title: task.title,
  })
  const lastSavedRef = useRef({
    description: toPlainText(task.description ?? []).trim(),
    title: task.title,
  })
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)
  const lastResetTaskIdRef = useRef(task._id)

  const assignee = assignedToDraft ? findUserByResourceUserId(assignedToDraft, users) : undefined
  const compactAssigneeName =
    formatCompactDisplayName(assignee?.profile?.displayName) ??
    assignee?.profile?.displayName ??
    'Unassigned'

  const isClosed = task.status === 'closed'
  const isOverdue = isDateValueOverdue(dueDateValue || undefined, task.status)
  const isSubscribed = currentResourceUserId
    ? (task.subscribers ?? []).includes(currentResourceUserId)
    : false
  const studioUrl = getStudioTaskUrl(task, workspaceId)
  const isSavingTextFields = isSavingDescription || isSavingTitle
  const selectedDueDate = parseDateOnlyString(dueDateValue || undefined)

  useEffect(() => {
    if (lastResetTaskIdRef.current === task._id) return
    lastResetTaskIdRef.current = task._id

    const nextDescription = toPlainText(task.description ?? []).trim()

    setAssignedToDraft(task.assignedTo)
    setDescriptionDraft(nextDescription)
    setDueDateValue(getDateInputValue(task.dueBy))
    setIsAssignPickerOpen(false)
    setIsDueDateEditorOpen(false)
    setIsSavingDescription(false)
    setIsSavingTitle(false)
    setTitleDraft(task.title)
    setTitleValidationMessage(null)

    latestDraftRef.current = {description: nextDescription, title: task.title}
    lastSavedRef.current = {description: nextDescription, title: task.title}
  }, [task._id, task.assignedTo, task.description, task.dueBy, task.title])

  useEffect(() => {
    latestDraftRef.current = {description: descriptionDraft, title: titleDraft}
  }, [descriptionDraft, titleDraft])

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [task._id])

  const autoGrowDescription = useCallback(() => {
    const textarea = descriptionTextareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useEffect(() => {
    autoGrowDescription()
  }, [autoGrowDescription, descriptionDraft])

  const clearTitleAutosaveTimer = useCallback(() => {
    if (!titleAutosaveTimerRef.current) return
    clearTimeout(titleAutosaveTimerRef.current)
    titleAutosaveTimerRef.current = null
  }, [])

  const clearDescriptionAutosaveTimer = useCallback(() => {
    if (!descriptionAutosaveTimerRef.current) return
    clearTimeout(descriptionAutosaveTimerRef.current)
    descriptionAutosaveTimerRef.current = null
  }, [])

  const saveTitleNow = useCallback(
    async (value: string, options?: {showValidationToast?: boolean}) => {
      const showValidationToast = options?.showValidationToast ?? true
      const normalized = value.trim()

      if (normalized.length === 0) {
        setTitleValidationMessage('Task title is required.')
        if (showValidationToast) {
          toast.push({
            status: 'warning',
            title: 'Task title is required.',
          })
        }
        return false
      }

      setTitleValidationMessage(null)
      if (normalized === lastSavedRef.current.title) return true

      setIsSavingTitle(true)
      const savePromise = editTask(task._id, {title: normalized})
        .then(() => {
          lastSavedRef.current.title = normalized
          return true
        })
        .catch((error) => {
          console.error('[TaskSummaryDetailView] saveTitleNow failed', {
            error,
            taskId: task._id,
            title: normalized,
          })
          toast.push({
            status: 'error',
            title: 'Failed to save task title.',
          })
          return false
        })
        .finally(() => {
          if (inFlightSavesRef.current.title === savePromise) {
            inFlightSavesRef.current.title = null
          }
          setIsSavingTitle(false)
        })

      inFlightSavesRef.current.title = savePromise
      return await savePromise
    },
    [editTask, task._id, toast],
  )

  const saveDescriptionNow = useCallback(
    async (value: string) => {
      if (value === lastSavedRef.current.description) return true

      setIsSavingDescription(true)
      const savePromise = editTask(task._id, {description: buildMessageFromPlainText(value)})
        .then(() => {
          lastSavedRef.current.description = value
          return true
        })
        .catch((error) => {
          console.error('[TaskSummaryDetailView] saveDescriptionNow failed', {
            description: value,
            error,
            taskId: task._id,
          })
          toast.push({
            status: 'error',
            title: 'Failed to save task description.',
          })
          return false
        })
        .finally(() => {
          if (inFlightSavesRef.current.description === savePromise) {
            inFlightSavesRef.current.description = null
          }
          setIsSavingDescription(false)
        })

      inFlightSavesRef.current.description = savePromise
      return await savePromise
    },
    [editTask, task._id, toast],
  )

  const scheduleTitleAutosave = useCallback(
    (nextTitle: string) => {
      clearTitleAutosaveTimer()

      if (nextTitle.trim().length === 0) {
        setTitleValidationMessage('Task title is required.')
        return
      }

      titleAutosaveTimerRef.current = setTimeout(() => {
        titleAutosaveTimerRef.current = null
        void saveTitleNow(nextTitle, {showValidationToast: false})
      }, TEXT_AUTOSAVE_DEBOUNCE_MS)
    },
    [clearTitleAutosaveTimer, saveTitleNow],
  )

  const scheduleDescriptionAutosave = useCallback(
    (nextDescription: string) => {
      clearDescriptionAutosaveTimer()
      descriptionAutosaveTimerRef.current = setTimeout(() => {
        descriptionAutosaveTimerRef.current = null
        void saveDescriptionNow(nextDescription)
      }, TEXT_AUTOSAVE_DEBOUNCE_MS)
    },
    [clearDescriptionAutosaveTimer, saveDescriptionNow],
  )

  const flushPendingWrites = useCallback(async () => {
    let success = true

    const hasUnsavedEmptyTitle =
      latestDraftRef.current.title.trim().length === 0 &&
      latestDraftRef.current.title !== lastSavedRef.current.title
    if (hasUnsavedEmptyTitle) {
      success = (await saveTitleNow(latestDraftRef.current.title)) && success
    }

    if (titleAutosaveTimerRef.current) {
      clearTitleAutosaveTimer()
      success = (await saveTitleNow(latestDraftRef.current.title)) && success
    }

    if (descriptionAutosaveTimerRef.current) {
      clearDescriptionAutosaveTimer()
      success = (await saveDescriptionNow(latestDraftRef.current.description)) && success
    }

    const inFlightSaves = [
      inFlightSavesRef.current.title,
      inFlightSavesRef.current.description,
    ].filter((candidate): candidate is Promise<boolean> => Boolean(candidate))

    for (const inFlightSave of inFlightSaves) {
      success = (await inFlightSave) && success
    }

    return success
  }, [clearDescriptionAutosaveTimer, clearTitleAutosaveTimer, saveDescriptionNow, saveTitleNow])

  useEffect(() => {
    onRegisterFlushPending?.(flushPendingWrites)
    return () => {
      onRegisterFlushPending?.(null)
    }
  }, [flushPendingWrites, onRegisterFlushPending])

  useEffect(
    () => () => {
      clearTitleAutosaveTimer()
      clearDescriptionAutosaveTimer()
    },
    [clearDescriptionAutosaveTimer, clearTitleAutosaveTimer],
  )

  useClickOutsideEvent(isAssignPickerOpen ? () => setIsAssignPickerOpen(false) : undefined, () => [
    assignButtonRef.current,
    assignPickerRef.current,
  ])
  useClickOutsideEvent(
    isDueDateEditorOpen ? () => setIsDueDateEditorOpen(false) : undefined,
    () => [dueDateButtonRef.current, dueDateEditorRef.current],
  )

  const handleBack = useCallback(async () => {
    onInternalInteraction?.()
    const canNavigateBack = await flushPendingWrites()
    if (!canNavigateBack) return
    onBack()
  }, [flushPendingWrites, onBack, onInternalInteraction])

  const handleAssign = useCallback(
    (resourceUserId: string | undefined) => {
      const previousAssignee = assignedToDraft
      setAssignedToDraft(resourceUserId)
      setIsAssignPickerOpen(false)
      onInternalInteraction?.(500)

      editTask(task._id, {assignedTo: resourceUserId ?? ''}).catch((error) => {
        console.error('[TaskSummaryDetailView] handleAssign failed', {
          assignedTo: resourceUserId,
          error,
          taskId: task._id,
        })
        setAssignedToDraft(previousAssignee)
        toast.push({
          status: 'error',
          title: 'Failed to update assignee.',
        })
      })
    },
    [assignedToDraft, editTask, onInternalInteraction, task._id, toast],
  )

  const handleDelete = useCallback(async () => {
    onInternalInteraction?.(3000)
    onDeleteOptimistic?.(task._id)
    if (!onDeleteOptimistic) {
      onBack()
    }
    try {
      await removeTask(task._id)
    } catch {
      onDeleteRollback?.(task._id)
      // Error already logged in the mutation hook.
    }
  }, [onBack, onDeleteOptimistic, onDeleteRollback, onInternalInteraction, removeTask, task._id])

  const handleSelectDueDate = useCallback(
    (date: Date | undefined) => {
      if (!date) return

      const previousDueDateValue = dueDateValue
      const nextDueDateValue = formatDateOnlyString(date)
      setDueDateValue(nextDueDateValue)
      setIsDueDateEditorOpen(false)
      onInternalInteraction?.(500)

      editTask(task._id, {dueBy: toDueDateIsoString(nextDueDateValue)}).catch((error) => {
        console.error('[TaskSummaryDetailView] handleSelectDueDate failed', {
          dueBy: nextDueDateValue,
          error,
          taskId: task._id,
        })
        setDueDateValue(previousDueDateValue)
        toast.push({
          status: 'error',
          title: 'Failed to update due date.',
        })
      })
    },
    [dueDateValue, editTask, onInternalInteraction, task._id, toast],
  )

  const handleToggleSubscription = useCallback(() => {
    if (!currentResourceUserId) return
    const currentSubscribers = task.subscribers ?? []
    const nextSubscribers = isSubscribed
      ? currentSubscribers.filter((subscriber) => subscriber !== currentResourceUserId)
      : [...new Set([...currentSubscribers, currentResourceUserId])]
    editTask(task._id, {subscribers: nextSubscribers}).catch((error) => {
      console.error('[TaskSummaryDetailView] handleToggleSubscription failed', {
        error,
        nextSubscribers,
        taskId: task._id,
      })
      toast.push({
        status: 'error',
        title: 'Failed to update subscription.',
      })
    })
  }, [currentResourceUserId, editTask, isSubscribed, task._id, task.subscribers, toast])

  return (
    <Stack space={4}>
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={2} style={{flex: 1, minWidth: 0}}>
          <Button
            icon={<ChevronLeft size={16} />}
            mode="bleed"
            onClick={() => {
              void handleBack()
            }}
            padding={2}
          />
          <input
            autoFocus
            onBlur={() => {
              void flushPendingWrites()
            }}
            onChange={(event) => {
              const nextTitle = event.target.value
              setTitleDraft(nextTitle)
              latestDraftRef.current.title = nextTitle
              scheduleTitleAutosave(nextTitle)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void flushPendingWrites()
              }
            }}
            placeholder="Task title..."
            ref={titleInputRef}
            style={fullWidthInputStyle}
            value={titleDraft}
          />
        </Flex>
        <Flex align="center" gap={2}>
          {isSavingTextFields && (
            <Text muted size={1}>
              Saving...
            </Text>
          )}
          <TaskActionsMenu onDelete={handleDelete} studioUrl={studioUrl} />
        </Flex>
      </Flex>

      {titleValidationMessage && (
        <Text muted size={1} style={{color: 'var(--card-caution-fg-color)'}}>
          {titleValidationMessage}
        </Text>
      )}

      <Flex align="center" gap={2} style={{flexWrap: 'wrap'}}>
        <TaskMetadataChip
          onClick={() =>
            toggleTaskStatus(task._id, task.status).catch((error) => {
              console.error('[TaskSummaryDetailView] toggleTaskStatus failed', {
                currentStatus: task.status,
                error,
                taskId: task._id,
              })
              toast.push({
                status: 'error',
                title: 'Failed to update task status.',
              })
            })
          }
        >
          <CircleDashed size={12} />
          <Text size={1}>{isClosed ? 'Done' : 'To Do'}</Text>
        </TaskMetadataChip>

        <Box style={{position: 'relative'}}>
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
              onAssign={handleAssign}
              pickerRef={assignPickerRef}
              users={users}
            />
          )}
        </Box>

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
                      const previousDueDateValue = dueDateValue
                      setDueDateValue('')
                      setIsDueDateEditorOpen(false)
                      onInternalInteraction?.(500)
                      editTask(task._id, {dueBy: ''}).catch((error) => {
                        console.error('[TaskSummaryDetailView] clearDueDate failed', {
                          error,
                          taskId: task._id,
                        })
                        setDueDateValue(previousDueDateValue)
                        toast.push({
                          status: 'error',
                          title: 'Failed to clear due date.',
                        })
                      })
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
            tone={isOverdue ? 'critical' : 'default'}
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
            onBlur={() => {
              void flushPendingWrites()
            }}
            onChange={(event) => {
              const nextDescription = event.target.value
              setDescriptionDraft(nextDescription)
              latestDraftRef.current.description = nextDescription
              scheduleDescriptionAutosave(nextDescription)
            }}
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

      <Box style={{borderTop: '1px solid var(--card-border-color)', paddingTop: 16}}>
        <Suspense
          fallback={
            <TaskDetailCommentsFallback
              isSubscribed={isSubscribed}
              onToggleSubscription={handleToggleSubscription}
            />
          }
        >
          <TaskDetailCommentsSection
            currentResourceUserId={currentResourceUserId}
            isSubscribed={isSubscribed}
            onToggleSubscription={handleToggleSubscription}
            task={task}
            workspaceId={workspaceId}
            workspaceTitle={workspaceTitle}
          />
        </Suspense>
      </Box>
    </Stack>
  )
}

function TaskDetailCommentsSection({
  currentResourceUserId,
  isSubscribed,
  onToggleSubscription,
  task,
  workspaceId,
  workspaceTitle,
}: {
  currentResourceUserId: string | undefined
  isSubscribed: boolean
  onToggleSubscription: () => void
  task: TaskDocument
  workspaceId?: string
  workspaceTitle?: string
}) {
  const taskCommentsState = useTaskComments(task._id)
  const taskCommentMutations = useTaskCommentMutations(task)
  const studioUrl = getStudioTaskUrl(task, workspaceId)

  const commentAdapter = useMemo<SharedCommentsAdapter>(
    () => ({
      buildOptimisticComment: ({authorId, commentId, message, parentCommentId, threadId}) =>
        buildTaskCommentDocument({
          authorId,
          commentId,
          message,
          parentCommentId,
          subscribers: task.subscribers,
          taskId: task._id,
          taskStudioUrl: studioUrl,
          taskTitle: task.title,
          threadId,
          workspaceId,
          workspaceTitle,
        }),
      createComment: ({commentId, message, parentCommentId, threadId}) =>
        taskCommentMutations.createComment(message, parentCommentId, threadId, commentId),
    }),
    [studioUrl, task, taskCommentMutations, workspaceId, workspaceTitle],
  )

  return (
    <SharedCommentsPanel
      commentAdapter={commentAdapter}
      commentsState={taskCommentsState}
      documentId={task._id}
      documentTitle={task.title}
      documentType="tasks.task"
      headerActions={
        <Button
          icon={isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
          mode="bleed"
          onClick={onToggleSubscription}
          padding={2}
          text={isSubscribed ? 'Subscribed' : 'Subscribe'}
        />
      }
      headerTitle="Comments"
      placeholder={currentResourceUserId ? 'Add a comment...' : 'Sign in to post comments'}
    />
  )
}

function TaskDetailCommentsFallback({
  isSubscribed,
  onToggleSubscription,
}: {
  isSubscribed: boolean
  onToggleSubscription: () => void
}) {
  return (
    <Stack space={3}>
      <Flex align="center" justify="space-between">
        <Text size={1} weight="semibold">
          Comments
        </Text>
        <Button
          icon={isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
          mode="bleed"
          onClick={onToggleSubscription}
          padding={2}
          text={isSubscribed ? 'Subscribed' : 'Subscribe'}
        />
      </Flex>
      <Card border padding={3} radius={2} tone="transparent">
        <Text muted size={1}>
          Loading comments...
        </Text>
      </Card>
    </Stack>
  )
}
