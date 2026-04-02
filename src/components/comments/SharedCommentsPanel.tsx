import {useUsers} from '@sanity/sdk-react'
import {Badge, Flex, Stack, Switch, Text} from '@sanity/ui'
import {useMemo, useState} from 'react'

import {useAddonData} from '../../context/AddonDataContext'
import {
  buildCommentDocument,
  buildCommentThreads,
  getCommentThreadsForField,
} from '../../helpers/comments/addonCommentUtils'
import {useAddonCommentMutations} from '../../hooks/useAddonCommentMutations'
import {useCurrentResourceUserId} from '../../hooks/useCurrentResourceUserId'
import type {
  SharedCommentsAdapter,
  SharedCommentsState,
} from '../../types/comments/sharedCommentsTypes'
import {SharedCommentsComposer} from './SharedCommentsComposer'
import {SharedCommentsThread} from './SharedCommentsThread'

interface SharedCommentsPanelProps {
  commentsState: SharedCommentsState
  commentAdapter?: SharedCommentsAdapter
  documentId: string
  documentTitle: string
  documentType: string
  emptyMessage?: string
  fieldPath?: string
  headerActions?: React.ReactNode
  headerSubtitle?: string
  headerTitle?: string
  placeholder?: string
}

export type {SharedCommentsAdapter} from '../../types/comments/sharedCommentsTypes'

export function SharedCommentsPanel({
  commentsState,
  commentAdapter,
  documentId,
  documentTitle,
  documentType,
  emptyMessage,
  fieldPath,
  headerActions,
  headerSubtitle,
  headerTitle,
  placeholder,
}: SharedCommentsPanelProps) {
  const {contentDataset, projectId, workspaceId, workspaceTitle} = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId()
  const commentMutations = useAddonCommentMutations()
  const {data: users = []} = useUsers()
  const [showResolved, setShowResolved] = useState(false)

  const {
    addOptimisticComment,
    comments,
    deleteOptimisticComment,
    editOptimisticComment,
    isPending,
    updateOptimisticReactions,
    updateOptimisticStatus,
  } = commentsState

  const allThreads = useMemo(() => {
    if (fieldPath) {
      return getCommentThreadsForField(comments, {field: fieldPath, includeResolved: true})
    }
    return buildCommentThreads(comments).sort(
      (a, b) => new Date(b.parent._createdAt).getTime() - new Date(a.parent._createdAt).getTime(),
    )
  }, [comments, fieldPath])

  const visibleThreads = useMemo(() => {
    if (fieldPath) {
      return getCommentThreadsForField(comments, {field: fieldPath, includeResolved: showResolved})
    }
    const threads = buildCommentThreads(comments)
    const filtered = showResolved
      ? threads
      : threads.filter((thread) => thread.parent.status !== 'resolved')
    return filtered.sort(
      (a, b) => new Date(b.parent._createdAt).getTime() - new Date(a.parent._createdAt).getTime(),
    )
  }, [comments, fieldPath, showResolved])

  const unresolvedCount = allThreads.filter((thread) => thread.parent.status !== 'resolved').length
  const hasAnyComments = allThreads.length > 0
  const summary =
    headerSubtitle ??
    (hasAnyComments && (
      <Flex align="center" gap={2}>
        <Badge tone="caution" padding={2}>
          {unresolvedCount} Open
        </Badge>
        <Badge tone="positive" padding={2}>
          {allThreads.length - unresolvedCount} Resolved
        </Badge>
      </Flex>
    ))

  const resolvedToggle = (
    <Flex align="center" gap={2}>
      <Text muted size={1}>
        Show resolved
      </Text>
      <Switch
        checked={showResolved}
        onChange={(event) => setShowResolved(event.currentTarget.checked)}
      />
    </Flex>
  )

  const resolvedToggleVisible = hasAnyComments ? resolvedToggle : null
  const defaultCommentAdapter = useMemo<SharedCommentsAdapter>(
    () => ({
      buildOptimisticComment: ({
        authorId,
        commentId,
        documentId,
        documentTitle,
        documentType,
        fieldPath,
        message,
        parentCommentId,
        threadId,
      }) =>
        buildCommentDocument({
          authorId,
          commentId,
          contentDataset: contentDataset ?? '',
          documentId,
          documentTitle,
          documentType,
          field: fieldPath,
          message,
          parentCommentId,
          projectId,
          threadId,
          workspaceId,
          workspaceTitle,
        }),
      createComment: ({
        commentId,
        documentId,
        documentTitle,
        documentType,
        fieldPath,
        message,
        parentCommentId,
        threadId,
      }) =>
        commentMutations.createComment(
          documentId,
          documentType,
          documentTitle,
          message,
          parentCommentId,
          threadId,
          commentId,
          fieldPath,
        ),
    }),
    [commentMutations, contentDataset, projectId, workspaceId, workspaceTitle],
  )
  const effectiveCommentAdapter = commentAdapter ?? defaultCommentAdapter

  return (
    <Stack space={4} style={{opacity: isPending ? 0.6 : 1}}>
      {(headerTitle || summary) && (
        <Flex align="center" justify="space-between">
          <Stack space={2}>
            {headerTitle && (
              <Text size={1} weight="semibold">
                {headerTitle}
              </Text>
            )}
            {summary &&
              (typeof summary === 'string' ? (
                <Text muted size={1}>
                  {summary}
                </Text>
              ) : (
                summary
              ))}
          </Stack>
          {(headerActions || resolvedToggleVisible) && (
            <Flex align="center" gap={3}>
              {headerActions}
              {resolvedToggleVisible}
            </Flex>
          )}
        </Flex>
      )}

      {!headerTitle && !summary && (headerActions || resolvedToggleVisible) && (
        <Flex align="center" justify="flex-end" gap={3}>
          {headerActions}
          {resolvedToggleVisible}
        </Flex>
      )}

      {visibleThreads.length > 0 ? (
        <Stack space={3}>
          {visibleThreads.map(({parent, replies}) => (
            <SharedCommentsThread
              commentAdapter={effectiveCommentAdapter}
              currentResourceUserId={currentResourceUserId}
              documentId={documentId}
              documentTitle={documentTitle}
              documentType={documentType}
              key={parent._id}
              onOptimisticAdd={addOptimisticComment}
              onOptimisticDelete={deleteOptimisticComment}
              onOptimisticEdit={editOptimisticComment}
              onOptimisticReactions={updateOptimisticReactions}
              onOptimisticStatus={updateOptimisticStatus}
              parent={parent}
              replies={replies}
              users={users}
            />
          ))}
        </Stack>
      ) : hasAnyComments ? (
        <Text muted size={1}>
          {emptyMessage ??
            (fieldPath
              ? showResolved
                ? 'No comments on this field yet.'
                : 'No open comments on this field.'
              : 'No comments yet.')}
        </Text>
      ) : null}

      <SharedCommentsComposer
        autoFocus={!hasAnyComments}
        commentAdapter={effectiveCommentAdapter}
        currentResourceUserId={currentResourceUserId ?? 'unknown'}
        documentId={documentId}
        documentTitle={documentTitle}
        documentType={documentType}
        fieldPath={fieldPath}
        onOptimisticAdd={addOptimisticComment}
        placeholder={placeholder ?? 'Add a comment...'}
      />
    </Stack>
  )
}
