import type {SanityUser} from '@sanity/sdk-react'
import {Box, Button, Card, Flex, Stack, Text, useClickOutsideEvent} from '@sanity/ui'
import {Bell, BellOff, Calendar, ChevronLeft, CircleDashed, Pencil} from 'lucide-react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {useAddonData} from '../../context/AddonDataContext'
import {buildTaskCommentDocument} from '../../helpers/comments/addonCommentUtils'
import {
  dateInputStyle,
  dueDateEditorStyle,
  getDateInputValue,
  getStudioTaskUrl,
  getTaskDueDateLabel,
  inlineInputStyle,
  isTaskOverdue,
  toDueDateIsoString,
} from '../../helpers/tasks/TaskSummaryUtils'
import {findUserByResourceUserId} from '../../helpers/users/addonUserUtils'
import {useAddonTaskMutations} from '../../hooks/useAddonTaskMutations'
import {useCurrentResourceUserId} from '../../hooks/useCurrentResourceUserId'
import {useTaskCommentMutations} from '../../hooks/useTaskCommentMutations'
import {useTaskComments} from '../../hooks/useTaskComments'
import type {TaskDocument} from '../../types/addonTypes'
import {CommentInput} from '../comments/CommentInput'
import {SharedCommentsPanel, type SharedCommentsAdapter} from '../comments/SharedCommentsPanel'
import {TaskSummaryAssignPicker} from './TaskSummaryAssignPicker'
import {
  InlineIconButton,
  TaskActionsMenu,
  TaskMetadataChip,
  TaskUserAvatar,
} from './TaskSummaryShared'

export function TaskSummaryDetailView({
  onBack,
  task,
  users,
}: {
  onBack: () => void
  task: TaskDocument
  users: SanityUser[]
}) {
  const {workspaceId, workspaceTitle} = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId()
  const {editTask, removeTask, toggleTaskStatus} = useAddonTaskMutations()
  const taskCommentsState = useTaskComments(task._id)
  const taskCommentMutations = useTaskCommentMutations(task)
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false)
  const [isDueDateEditorOpen, setIsDueDateEditorOpen] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [dueDateValue, setDueDateValue] = useState(() => getDateInputValue(task.dueBy))
  const assignButtonRef = useRef<HTMLButtonElement>(null)
  const assignPickerRef = useRef<HTMLDivElement>(null)
  const dueDateButtonRef = useRef<HTMLButtonElement>(null)
  const dueDateEditorRef = useRef<HTMLDivElement>(null)
  const assignee = task.assignedTo ? findUserByResourceUserId(task.assignedTo, users) : undefined
  const isClosed = task.status === 'closed'
  const isOverdue = isTaskOverdue(task)
  const isSubscribed = currentResourceUserId
    ? (task.subscribers ?? []).includes(currentResourceUserId)
    : false
  const studioUrl = getStudioTaskUrl(task, workspaceId)

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(task.title)
    }
  }, [isEditingTitle, task.title])

  useEffect(() => {
    if (!isDueDateEditorOpen) {
      setDueDateValue(getDateInputValue(task.dueBy))
    }
  }, [isDueDateEditorOpen, task.dueBy])

  useClickOutsideEvent(isAssignPickerOpen ? () => setIsAssignPickerOpen(false) : undefined, () => [
    assignButtonRef.current,
    assignPickerRef.current,
  ])
  useClickOutsideEvent(
    isDueDateEditorOpen ? () => setIsDueDateEditorOpen(false) : undefined,
    () => [dueDateButtonRef.current, dueDateEditorRef.current],
  )

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

  const handleAssign = useCallback(
    (resourceUserId: string | undefined) => {
      editTask(task._id, {assignedTo: resourceUserId || ''}).catch(() => {})
      setIsAssignPickerOpen(false)
    },
    [editTask, task._id],
  )

  const handleDelete = useCallback(() => {
    removeTask(task._id).catch(() => {})
    onBack()
  }, [onBack, removeTask, task._id])

  const handleSaveTitle = useCallback(() => {
    const nextTitle = titleDraft.trim()
    if (!nextTitle) return
    if (nextTitle !== task.title) {
      editTask(task._id, {title: nextTitle}).catch(() => {})
    }
    setIsEditingTitle(false)
  }, [editTask, task._id, task.title, titleDraft])

  const handleSaveDueDate = useCallback(() => {
    editTask(task._id, {dueBy: dueDateValue ? toDueDateIsoString(dueDateValue) : ''}).catch(
      () => {},
    )
    setIsDueDateEditorOpen(false)
  }, [dueDateValue, editTask, task._id])

  const handleToggleSubscription = useCallback(() => {
    if (!currentResourceUserId) return
    const currentSubscribers = task.subscribers ?? []
    const nextSubscribers = isSubscribed
      ? currentSubscribers.filter((subscriber) => subscriber !== currentResourceUserId)
      : [...new Set([...currentSubscribers, currentResourceUserId])]
    editTask(task._id, {subscribers: nextSubscribers}).catch(() => {})
  }, [currentResourceUserId, editTask, isSubscribed, task._id, task.subscribers])

  return (
    <Stack space={4}>
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={2} style={{flex: 1, minWidth: 0}}>
          <Button icon={<ChevronLeft size={16} />} mode="bleed" onClick={onBack} padding={2} />
          {isEditingTitle ? (
            <Flex align="center" gap={1} style={{flex: 1, minWidth: 0}}>
              <input
                autoFocus
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSaveTitle()
                  if (event.key === 'Escape') {
                    setTitleDraft(task.title)
                    setIsEditingTitle(false)
                  }
                }}
                style={inlineInputStyle}
                value={titleDraft}
              />
              <Button fontSize={1} mode="bleed" onClick={handleSaveTitle} text="Save" />
              <Button
                fontSize={1}
                mode="bleed"
                onClick={() => {
                  setTitleDraft(task.title)
                  setIsEditingTitle(false)
                }}
                text="Cancel"
              />
            </Flex>
          ) : (
            <>
              <Text size={3} weight="semibold" style={{flex: 1, minWidth: 0}}>
                {task.title}
              </Text>
              <InlineIconButton label="Edit title" onClick={() => setIsEditingTitle(true)}>
                <Pencil size={14} />
              </InlineIconButton>
            </>
          )}
        </Flex>

        <TaskActionsMenu onDelete={handleDelete} studioUrl={studioUrl} />
      </Flex>

      <Flex align="center" gap={2} style={{flexWrap: 'wrap'}}>
        <TaskMetadataChip onClick={() => toggleTaskStatus(task._id, task.status).catch(() => {})}>
          <CircleDashed size={12} />
          <Text size={1}>{isClosed ? 'Done' : 'To Do'}</Text>
        </TaskMetadataChip>

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
              currentAssignee={task.assignedTo}
              onAssign={handleAssign}
              pickerRef={assignPickerRef}
              users={users}
            />
          )}
        </Box>

        <Box style={{position: 'relative'}}>
          <TaskMetadataChip
            onClick={() => setIsDueDateEditorOpen((current) => !current)}
            ref={dueDateButtonRef}
            tone={isOverdue ? 'critical' : 'default'}
          >
            <Calendar size={12} />
            <Text size={1}>{getTaskDueDateLabel(task) ?? 'No date'}</Text>
          </TaskMetadataChip>
          {isDueDateEditorOpen && (
            <Card
              border
              padding={2}
              radius={2}
              ref={dueDateEditorRef}
              shadow={2}
              style={dueDateEditorStyle}
            >
              <Stack space={2}>
                <input
                  autoFocus
                  onChange={(event) => setDueDateValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSaveDueDate()
                    if (event.key === 'Escape') {
                      setDueDateValue(getDateInputValue(task.dueBy))
                      setIsDueDateEditorOpen(false)
                    }
                  }}
                  style={dateInputStyle}
                  type="date"
                  value={dueDateValue}
                />
                <Flex align="center" gap={2} justify="flex-end">
                  {task.dueBy && (
                    <Button
                      fontSize={1}
                      mode="bleed"
                      onClick={() => {
                        setDueDateValue('')
                        editTask(task._id, {dueBy: ''}).catch(() => {})
                        setIsDueDateEditorOpen(false)
                      }}
                      text="Clear"
                    />
                  )}
                  <Button
                    fontSize={1}
                    mode="bleed"
                    onClick={() => {
                      setDueDateValue(getDateInputValue(task.dueBy))
                      setIsDueDateEditorOpen(false)
                    }}
                    text="Cancel"
                  />
                  <Button
                    fontSize={1}
                    mode="ghost"
                    onClick={handleSaveDueDate}
                    text="Save"
                    tone="primary"
                  />
                </Flex>
              </Stack>
            </Card>
          )}
        </Box>
      </Flex>

      <Card border padding={3} radius={2} tone="transparent">
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Description
          </Text>
          <CommentInput
            initialValue={task.description}
            key={`${task._id}:${task.lastEditedAt ?? task._updatedAt}:description`}
            onSubmit={(message) => editTask(task._id, {description: message}).catch(() => {})}
            placeholder="Add a description..."
            showSendButton
          />
        </Stack>
      </Card>

      <Box style={{borderTop: '1px solid var(--card-border-color)', paddingTop: 16}}>
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
              onClick={handleToggleSubscription}
              padding={2}
              text={isSubscribed ? 'Subscribed' : 'Subscribe'}
            />
          }
          headerTitle="Comments"
          placeholder="Add a comment..."
        />
      </Box>
    </Stack>
  )
}
