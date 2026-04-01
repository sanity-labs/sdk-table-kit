import {PortableText} from '@portabletext/react'
import {EditIcon, LinkIcon, TrashIcon} from '@sanity/icons'
import type {SanityUser} from '@sanity/sdk-react'
import {useUsers} from '@sanity/sdk-react'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  Popover,
  Stack,
  Switch,
  Text,
  Tooltip,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {CheckCircle2, MoreHorizontal, SmilePlus, Undo2} from 'lucide-react'
import {useCallback, useMemo, useRef, useState} from 'react'

import {
  buildCommentDocument,
  buildCommentThreads,
  getCommentThreadsForField,
} from './addonCommentUtils'
import {useAddonData} from './AddonDataContext'
import type {AddonMessage, CommentDocument, CommentReaction, CommentStatus} from './addonTypes'
import {findUserByResourceUserId} from './addonUserUtils'
import {CommentInput, type CommentInputHandle} from './CommentInput'
import {useAddonCommentMutations} from './useAddonCommentMutations'
import {useAddonComments} from './useAddonComments'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

const REACTION_OPTIONS: Array<{emoji: string; shortName: string; title: string}> = [
  {emoji: '👍', shortName: ':+1:', title: 'Thumbs up'},
  {emoji: '👎', shortName: ':-1:', title: 'Thumbs down'},
  {emoji: '❤️', shortName: ':heart:', title: 'Heart'},
  {emoji: '🚀', shortName: ':rocket:', title: 'Rocket'},
  {emoji: '➕', shortName: ':heavy_plus_sign:', title: 'Plus'},
  {emoji: '👀', shortName: ':eyes:', title: 'Eyes'},
]

const EMOJI_MAP: Record<string, string> = Object.fromEntries(
  REACTION_OPTIONS.map((reaction) => [reaction.shortName, reaction.emoji]),
)

interface SharedCommentsPanelProps {
  commentsState: ReturnType<typeof useAddonComments>
  documentId: string
  documentTitle: string
  documentType: string
  emptyMessage?: string
  fieldPath?: string
  headerSubtitle?: string
  headerTitle?: string
}

interface AddCommentFormProps {
  autoFocus?: boolean
  documentId: string
  documentTitle: string
  documentType: string
  fieldPath?: string
  onCancel?: () => void
  onOptimisticAdd: (comment: CommentDocument) => () => void
  parentCommentId?: string
  placeholder: string
  threadId?: string
}

interface CommentItemProps {
  comment: CommentDocument
  isOwn: boolean
  isParent?: boolean
  isReply?: boolean
  onDelete: (commentId: string) => void
  onEdit: (commentId: string) => void
  onReaction: (commentId: string, shortName: string, reactions: CommentReaction[]) => void
  onResolve?: () => void
  resolveLabel?: string
  users: SanityUser[]
}

interface SharedCommentThreadProps {
  currentResourceUserId?: string
  documentId: string
  documentTitle: string
  documentType: string
  onOptimisticAdd: (comment: CommentDocument) => () => void
  onOptimisticDelete: (commentId: string) => () => void
  onOptimisticEdit: (commentId: string, message: AddonMessage, lastEditedAt: string) => () => void
  onOptimisticReactions: (commentId: string, reactions: CommentReaction[]) => () => void
  onOptimisticStatus: (commentId: string, status: CommentStatus) => () => void
  parent: CommentDocument
  replies: CommentDocument[]
  users: SanityUser[]
}

interface EditCommentFormProps {
  comment: CommentDocument
  isReply?: boolean
  onCancel: () => void
  onSave: (message: AddonMessage) => void
  users: SanityUser[]
}

export function SharedCommentsPanel({
  commentsState,
  documentId,
  documentTitle,
  documentType,
  emptyMessage,
  fieldPath,
  headerSubtitle,
  headerTitle,
}: SharedCommentsPanelProps) {
  const currentResourceUserId = useCurrentResourceUserId()
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
            {summary && (
              <Text muted size={1}>
                {summary}
              </Text>
            )}
          </Stack>
          {hasAnyComments && resolvedToggle}
        </Flex>
      )}

      {!headerTitle && !summary && hasAnyComments && <Flex justify="flex-end">{resolvedToggle}</Flex>}

      {visibleThreads.length > 0 ? (
        <Stack space={3}>
          {visibleThreads.map(({parent, replies}) => (
            <SharedCommentThread
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

      <AddCommentForm
        autoFocus={!hasAnyComments}
        documentId={documentId}
        documentTitle={documentTitle}
        documentType={documentType}
        fieldPath={fieldPath}
        onOptimisticAdd={addOptimisticComment}
        placeholder="Add a comment..."
      />
    </Stack>
  )
}

function AddCommentForm({
  autoFocus,
  documentId,
  documentTitle,
  documentType,
  fieldPath,
  onCancel,
  onOptimisticAdd,
  parentCommentId,
  placeholder,
  threadId,
}: AddCommentFormProps) {
  const {createComment} = useAddonCommentMutations()
  const {contentDataset, projectId, workspaceId, workspaceTitle} = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId() ?? 'unknown'
  const inputRef = useRef<CommentInputHandle>(null)

  const handleSubmit = useCallback(
    (message: AddonMessage) => {
      if (!message || message.length === 0) return

      const commentId = crypto.randomUUID()
      const optimisticComment: CommentDocument = buildCommentDocument({
        authorId: currentResourceUserId,
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
      })

      const rollback = onOptimisticAdd(optimisticComment)

      createComment(
        documentId,
        documentType,
        documentTitle,
        message,
        parentCommentId,
        threadId,
        commentId,
        fieldPath,
      ).catch(() => rollback())

      inputRef.current?.clear()
      onCancel?.()
    },
    [
      contentDataset,
      createComment,
      currentResourceUserId,
      documentId,
      documentTitle,
      documentType,
      fieldPath,
      onCancel,
      onOptimisticAdd,
      parentCommentId,
      projectId,
      threadId,
      workspaceId,
      workspaceTitle,
    ],
  )

  return (
    <CommentInput
      autoFocus={autoFocus ?? !!parentCommentId}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      placeholder={placeholder}
      ref={inputRef}
      showSendButton
    />
  )
}

function SharedCommentThread({
  currentResourceUserId,
  documentId,
  documentTitle,
  documentType,
  onOptimisticAdd,
  onOptimisticDelete,
  onOptimisticEdit,
  onOptimisticReactions,
  onOptimisticStatus,
  parent,
  replies,
  users,
}: SharedCommentThreadProps) {
  const {deleteComment, editComment, setCommentStatus, toggleReaction} = useAddonCommentMutations()
  const [editingCommentId, setEditingCommentId] = useState<null | string>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<null | string>(null)
  const isResolved = parent.status === 'resolved'

  const handleToggleResolve = useCallback(() => {
    const newStatus: CommentStatus = isResolved ? 'open' : 'resolved'
    const rollback = onOptimisticStatus(parent._id, newStatus)
    setCommentStatus(parent._id, newStatus).catch(() => rollback())
  }, [isResolved, onOptimisticStatus, parent._id, setCommentStatus])

  const handleDelete = useCallback(
    (commentId: string) => {
      const rollback = onOptimisticDelete(commentId)
      deleteComment(commentId).catch(() => rollback())
      setConfirmDeleteId(null)
    },
    [deleteComment, onOptimisticDelete],
  )

  const handleEdit = useCallback(
    (commentId: string, message: AddonMessage) => {
      const now = new Date().toISOString()
      const rollback = onOptimisticEdit(commentId, message, now)
      editComment(commentId, message).catch(() => rollback())
      setEditingCommentId(null)
    },
    [editComment, onOptimisticEdit],
  )

  const handleReaction = useCallback(
    (commentId: string, shortName: string, currentReactions: CommentReaction[]) => {
      const userId = currentResourceUserId ?? 'unknown'
      const existing = currentReactions.find(
        (reaction) => reaction.shortName === shortName && reaction.userId === userId,
      )

      const nextReactions = existing
        ? currentReactions.filter((reaction) => reaction._key !== existing._key)
        : [
            ...currentReactions,
            {
              _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
              addedAt: new Date().toISOString(),
              shortName,
              userId,
            },
          ]

      const rollback = onOptimisticReactions(commentId, nextReactions)
      toggleReaction(commentId, shortName, currentReactions).catch(() => rollback())
    },
    [currentResourceUserId, onOptimisticReactions, toggleReaction],
  )

  const renderComment = (comment: CommentDocument, isReply: boolean) => {
    const isOwn = comment.authorId === currentResourceUserId
    const isEditing = editingCommentId === comment._id
    const isConfirmingDelete = confirmDeleteId === comment._id

    if (isEditing) {
      return (
        <EditCommentForm
          comment={comment}
          isReply={isReply}
          key={comment._id}
          onCancel={() => setEditingCommentId(null)}
          onSave={(message) => handleEdit(comment._id, message)}
          users={users}
        />
      )
    }

    return (
      <div key={comment._id}>
        <CommentItem
          comment={comment}
          isOwn={isOwn}
          isParent={!isReply}
          isReply={isReply}
          onDelete={(id) => setConfirmDeleteId(id)}
          onEdit={(id) => setEditingCommentId(id)}
          onReaction={handleReaction}
          onResolve={!isReply ? handleToggleResolve : undefined}
          resolveLabel={!isReply ? (isResolved ? 'Reopen' : 'Resolve') : undefined}
          users={users}
        />

        {isConfirmingDelete && (
          <Card padding={2} tone="critical" style={{marginTop: 8}}>
            <Flex align="center" gap={2}>
              <Text size={1}>Delete this comment?</Text>
              <Button
                fontSize={1}
                mode="default"
                onClick={() => handleDelete(comment._id)}
                text="Delete"
                tone="critical"
              />
              <Button
                fontSize={1}
                mode="ghost"
                onClick={() => setConfirmDeleteId(null)}
                text="Cancel"
              />
            </Flex>
          </Card>
        )}
      </div>
    )
  }

  return (
    <Card padding={4} radius={2} border tone={isResolved ? 'positive' : 'neutral'}>
      <Stack space={4}>
        {renderComment(parent, false)}

        {replies.length > 0 && (
          <div
            style={{
              borderLeft: '2px solid var(--card-border-color)',
              marginLeft: 18,
              paddingLeft: 14,
            }}
          >
            <Stack space={4}>{replies.map((reply) => renderComment(reply, true))}</Stack>
          </div>
        )}

        <div style={{paddingLeft: 36}}>
          <AddCommentForm
            documentId={documentId}
            documentTitle={documentTitle}
            documentType={documentType}
            fieldPath={parent.target.path?.field}
            onOptimisticAdd={onOptimisticAdd}
            parentCommentId={parent._id}
            placeholder="Reply"
            threadId={parent.threadId ?? parent._id}
          />
        </div>
      </Stack>
    </Card>
  )
}

function CommentItem({
  comment,
  isOwn,
  isParent,
  isReply,
  onDelete,
  onEdit,
  onReaction,
  onResolve,
  resolveLabel,
  users,
}: CommentItemProps) {
  const author = findUserByResourceUserId(comment.authorId, users)
  const [hovered, setHovered] = useState(false)
  const [hasFocusWithin, setHasFocusWithin] = useState(false)
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const reactionPopoverRef = useRef<HTMLDivElement>(null)
  const reactionTriggerRef = useRef<HTMLButtonElement>(null)
  const controlsVisible = hovered || hasFocusWithin || reactionPickerOpen

  const ptComponents = useMemo(
    () => ({
      block: {
        normal: ({children}: {children?: React.ReactNode}) => (
          <p style={{margin: 0, fontSize: 14}}>{children}</p>
        ),
      },
      types: {
        mention: ({value}: {value: {userId: string}}) => {
          const mentionUser = findUserByResourceUserId(value.userId, users)
          return (
            <span style={{fontWeight: 600, color: '#2563eb'}}>
              @{mentionUser?.profile?.displayName ?? value.userId}
            </span>
          )
        },
      },
    }),
    [users],
  )

  const reactions = comment.reactions ?? []
  const hasMessage =
    comment.message &&
    comment.message.length > 0 &&
    comment.message.some((block) =>
      block.children.some((child) => {
        if (child._type === 'span') return !!child.text?.trim()
        return child._type === 'mention'
      }),
    )

  useClickOutsideEvent(reactionPickerOpen ? () => setReactionPickerOpen(false) : undefined, () => [
    reactionPopoverRef.current,
    reactionTriggerRef.current,
  ])

  useGlobalKeyDown((event) => {
    if (reactionPickerOpen && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setReactionPickerOpen(false)
    }
  })

  return (
    <div
      onBlurCapture={(event) => {
        const nextFocused = event.relatedTarget
        if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
          return
        }
        setHasFocusWithin(false)
      }}
      onFocusCapture={() => setHasFocusWithin(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{position: 'relative'}}
    >
      <Flex align="flex-start" gap={3}>
        {renderAvatar(author, author?.profile?.displayName ?? 'Unknown', isReply ? 20 : 24)}
        <div style={{flex: 1, minWidth: 0}}>
          <Flex align="center" gap={2} wrap="wrap">
            <Text size={1} weight="semibold">
              {author?.profile?.displayName ?? 'Unknown'}
            </Text>
            <Text muted size={1}>
              {relativeTimeAgo(comment._createdAt)}
            </Text>
            {comment.lastEditedAt && (
              <Text muted size={1}>
                (edited)
              </Text>
            )}
          </Flex>
          <div style={{marginTop: 4, whiteSpace: 'pre-wrap'}}>
            {hasMessage ? (
              <PortableText components={ptComponents} value={comment.message!} />
            ) : (
              <Text muted size={1}>
                Empty comment
              </Text>
            )}
          </div>
          {reactions.length > 0 && (
            <ReactionBar commentId={comment._id} onReaction={onReaction} reactions={reactions} />
          )}
        </div>
      </Flex>

      <Card
        padding={4}
        radius={2}
        shadow={2}
        style={{
          position: 'absolute',
          top: -10,
          right: 4,
          display: 'flex',
          gap: 4,
          padding: 4,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 120ms ease',
        }}
      >
        <Popover
          animate
          content={
            <Card radius={2} ref={reactionPopoverRef}>
              <Flex gap={1}>
                {REACTION_OPTIONS.map((option) => (
                  <Button
                    fontSize={1}
                    key={option.shortName}
                    mode="bleed"
                    onClick={() => {
                      onReaction(comment._id, option.shortName, reactions)
                      setReactionPickerOpen(false)
                    }}
                    padding={2}
                    text={option.emoji}
                    tone="default"
                  />
                ))}
              </Flex>
            </Card>
          }
          open={reactionPickerOpen}
          placement="bottom"
          portal
        >
          <Tooltip
            animate
            content={
              <Box padding={1}>
                <Text size={1}>Add reaction</Text>
              </Box>
            }
            delay={300}
            placement="bottom"
            portal
          >
            <Button
              icon={<SmilePlus size={16} />}
              mode="bleed"
              onClick={() => setReactionPickerOpen((value) => !value)}
              padding={2}
              ref={reactionTriggerRef}
            />
          </Tooltip>
        </Popover>

        {isParent && onResolve && (
          <Tooltip
            animate
            content={
              <Box padding={1}>
                <Text size={1}>{resolveLabel}</Text>
              </Box>
            }
            delay={300}
            placement="bottom"
            portal
          >
            <Button
              icon={resolveLabel === 'Reopen' ? <Undo2 size={16} /> : <CheckCircle2 size={16} />}
              mode="bleed"
              onClick={onResolve}
              padding={2}
            />
          </Tooltip>
        )}

        <MenuButton
          id={`comment-menu-${comment._id}`}
          button={<Button icon={<MoreHorizontal size={16} />} mode="bleed" padding={2} />}
          menu={
            <Menu>
              {isOwn && (
                <MenuItem icon={EditIcon} onClick={() => onEdit(comment._id)} text="Edit comment" />
              )}
              {isOwn && (
                <MenuItem
                  icon={TrashIcon}
                  onClick={() => onDelete(comment._id)}
                  text="Delete comment"
                  tone="critical"
                />
              )}
              <MenuItem icon={LinkIcon} onClick={() => {}} text="Copy link to comment" />
            </Menu>
          }
          popover={{portal: true}}
        />
      </Card>
    </div>
  )
}

function EditCommentForm({comment, isReply, onCancel, onSave, users}: EditCommentFormProps) {
  const author = findUserByResourceUserId(comment.authorId, users)

  return (
    <Flex align="flex-start" gap={3}>
      {renderAvatar(author, author?.profile?.displayName ?? 'Unknown', isReply ? 20 : 24)}
      <Flex direction="column" flex={1} gap={2} style={{minWidth: 0}}>
        <Flex align="center" gap={2}>
          <Text size={1} weight="semibold">
            {author?.profile?.displayName ?? 'Unknown'}
          </Text>
          <Text muted size={1}>
            {relativeTimeAgo(comment._createdAt)}
          </Text>
        </Flex>
        <div style={{marginTop: 6, minWidth: 0, width: '100%'}}>
          <CommentInput
            autoFocus
            initialValue={comment.message}
            onCancel={onCancel}
            onSubmit={(message) => onSave(message)}
            showSendButton
          />
        </div>
        <Flex justify="flex-end">
          <Button
            fontSize={1}
            mode="ghost"
            onClick={onCancel}
            padding={3}
            text="Cancel Edit"
            tone="critical"
          />
        </Flex>
      </Flex>
    </Flex>
  )
}

function ReactionBar({
  commentId,
  onReaction,
  reactions,
}: {
  commentId: string
  onReaction: (commentId: string, shortName: string, reactions: CommentReaction[]) => void
  reactions: CommentReaction[]
}) {
  const currentResourceUserId = useCurrentResourceUserId()

  const grouped = useMemo(() => {
    const map = new Map<string, {count: number; hasOwn: boolean; shortName: string}>()
    for (const reaction of reactions) {
      const entry = map.get(reaction.shortName) ?? {
        count: 0,
        hasOwn: false,
        shortName: reaction.shortName,
      }
      entry.count++
      if (reaction.userId === currentResourceUserId) entry.hasOwn = true
      map.set(reaction.shortName, entry)
    }
    return Array.from(map.values())
  }, [currentResourceUserId, reactions])

  if (grouped.length === 0) return null

  return (
    <Flex gap={1} style={{marginTop: 6, flexWrap: 'wrap'}}>
      {grouped.map(({count, hasOwn, shortName}) => (
        <button
          key={shortName}
          onClick={() => onReaction(commentId, shortName, reactions)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderRadius: 999,
            border: '1px solid var(--card-border-color)',
            padding: '2px 6px',
            background: hasOwn ? 'rgba(59,130,246,0.08)' : 'var(--card-bg-color)',
            color: hasOwn ? '#1d4ed8' : 'inherit',
            cursor: 'pointer',
            fontSize: 12,
          }}
          type="button"
        >
          <span style={{fontSize: 14}}>{EMOJI_MAP[shortName] ?? shortName}</span>
          <span>{count}</span>
        </button>
      ))}
    </Flex>
  )
}

function renderAvatar(user: SanityUser | undefined, displayName: string, size: number) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: user?.profile?.imageUrl
          ? 'transparent'
          : 'var(--card-badge-default-bg-color, #e3e4e8)',
        color: 'var(--card-badge-default-fg-color, #515e72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size <= 20 ? 7 : 10,
        fontWeight: 600,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {user?.profile?.imageUrl ? (
        <img
          alt={displayName}
          src={user.profile.imageUrl}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      ) : (
        getInitials(displayName)
      )}
    </div>
  )
}

function getInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function relativeTimeAgo(isoDate: string | undefined): string {
  if (!isoDate) return ''

  const diffMs = Date.now() - new Date(isoDate).getTime()
  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  const days = Math.floor(seconds / 86400)
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  }
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}
