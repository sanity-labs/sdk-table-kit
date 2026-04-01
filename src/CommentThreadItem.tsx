import {PortableText} from '@portabletext/react'
import {EditIcon, LinkIcon, TrashIcon} from '@sanity/icons'
import {useUsers} from '@sanity/sdk-react'
import {
  Avatar,
  Card,
  Flex,
  Popover,
  Stack,
  Text,
  Tooltip,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {CheckCircle2, MoreHorizontal, SmilePlus, Undo2} from 'lucide-react'
import {useMemo, useRef, useState} from 'react'

import type {AddonMessage, CommentDocument, CommentReaction} from './addonTypes'
import {findUserByResourceUserId} from './addonUserUtils'
import {CommentInput} from './CommentInput'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

const REACTION_OPTIONS: {emoji: string; shortName: string; title: string}[] = [
  {emoji: '👍', shortName: ':+1:', title: 'Thumbs up'},
  {emoji: '👎', shortName: ':-1:', title: 'Thumbs down'},
  {emoji: '❤️', shortName: ':heart:', title: 'Heart'},
  {emoji: '🚀', shortName: ':rocket:', title: 'Rocket'},
  {emoji: '➕', shortName: ':heavy_plus_sign:', title: 'Plus'},
  {emoji: '👀', shortName: ':eyes:', title: 'Eyes'},
]

const EMOJI_MAP: Record<string, string> = Object.fromEntries(
  REACTION_OPTIONS.map((entry) => [entry.shortName, entry.emoji]),
)

interface CommentThreadItemProps {
  comment: CommentDocument
  currentResourceUserId?: string
  isParent?: boolean
  isReply?: boolean
  onDelete: (commentId: string) => void
  onEdit: (commentId: string) => void
  onReaction: (commentId: string, shortName: string, reactions: CommentReaction[]) => void
  onResolve?: () => void
  resolveLabel?: string
}

interface EditCommentCardProps {
  comment: CommentDocument
  isReply?: boolean
  onCancel: () => void
  onSave: (message: AddonMessage) => void
}

export function CommentThreadItem({
  comment,
  currentResourceUserId,
  isParent,
  isReply,
  onDelete,
  onEdit,
  onReaction,
  onResolve,
  resolveLabel,
}: CommentThreadItemProps) {
  const {data: users = []} = useUsers()
  const author = findUserByResourceUserId(comment.authorId, users)
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const reactionPopoverRef = useRef<HTMLDivElement>(null)
  const reactionTriggerRef = useRef<HTMLButtonElement>(null)
  const menuPopoverRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  const portableTextComponents = useMemo(
    () => ({
      block: {
        normal: ({children}: {children?: React.ReactNode}) => (
          <p style={{margin: 0, fontSize: 14, lineHeight: 1.5}}>{children}</p>
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
  useClickOutsideEvent(menuOpen ? () => setMenuOpen(false) : undefined, () => [
    menuPopoverRef.current,
    menuTriggerRef.current,
  ])

  useGlobalKeyDown((event) => {
    if (!reactionPickerOpen || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    setReactionPickerOpen(false)
  })

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{position: 'relative'}}
    >
      <Flex gap={3}>
        <Avatar
          alt={author?.profile?.displayName ?? 'Unknown'}
          size={isReply ? 0 : 1}
          src={author?.profile?.imageUrl ?? ''}
          style={{opacity: author?.profile?.imageUrl ? 1 : 0.25, flexShrink: 0, marginTop: 2}}
        />
        <div style={{flex: 1, minWidth: 0}}>
          <Flex align="baseline" gap={2} wrap="wrap">
            <Text size={1} weight="semibold">
              {author?.profile?.displayName ?? 'Unknown'}
            </Text>
            <Text muted size={1}>
              {relativeTimeAgo(comment._createdAt)}
            </Text>
            {comment.lastEditedAt && (
              <Text muted size={1}>
                Edited
              </Text>
            )}
          </Flex>
          <div style={{marginTop: 4, whiteSpace: 'pre-wrap'}}>
            {hasMessage ? (
              <PortableText components={portableTextComponents} value={comment.message!} />
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

      <div
        style={{
          position: 'absolute',
          top: -10,
          right: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderRadius: 8,
          border: '1px solid var(--card-border-color)',
          background: 'var(--card-bg-color)',
          padding: '2px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          opacity: hovered || menuOpen || reactionPickerOpen ? 1 : 0,
          pointerEvents: hovered || menuOpen || reactionPickerOpen ? 'auto' : 'none',
          transition: 'opacity 120ms ease',
        }}
        className="shared-comment-actions"
      >
        <Popover
          animate
          content={
            <Card padding={2} ref={reactionPopoverRef} radius={2} shadow={2}>
              <Flex gap={1}>
                {REACTION_OPTIONS.map((option) => (
                  <Tooltip content={option.title} key={option.shortName} placement="top" portal>
                    <button
                      onClick={() => {
                        onReaction(comment._id, option.shortName, reactions)
                        setReactionPickerOpen(false)
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        border: 'none',
                        background: 'transparent',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 16,
                      }}
                      type="button"
                    >
                      {option.emoji}
                    </button>
                  </Tooltip>
                ))}
              </Flex>
            </Card>
          }
          open={reactionPickerOpen}
          placement="top"
          portal
        >
          <Tooltip content="Add reaction" placement="top" portal>
            <button
              onClick={() => setReactionPickerOpen((value) => !value)}
              ref={reactionTriggerRef}
              style={actionButtonStyle}
              type="button"
            >
              <SmilePlus size={14} />
            </button>
          </Tooltip>
        </Popover>

        {isParent && onResolve && (
          <Tooltip content={resolveLabel} placement="top" portal>
            <button onClick={onResolve} style={actionButtonStyle} type="button">
              {resolveLabel === 'Reopen' ? <Undo2 size={14} /> : <CheckCircle2 size={14} />}
            </button>
          </Tooltip>
        )}

        <Popover
          animate
          content={
            <Card padding={2} radius={2} ref={menuPopoverRef} shadow={2}>
              <Stack space={1}>
                {comment.authorId === currentResourceUserId && (
                  <button
                    onClick={() => {
                      onEdit(comment._id)
                      setMenuOpen(false)
                    }}
                    style={menuItemStyle}
                    type="button"
                  >
                    <EditIcon />
                    <span>Edit comment</span>
                  </button>
                )}
                {comment.authorId === currentResourceUserId && (
                  <button
                    onClick={() => {
                      onDelete(comment._id)
                      setMenuOpen(false)
                    }}
                    style={{
                      ...menuItemStyle,
                      color: 'var(--card-badge-critical-fg-color, #b91c1c)',
                    }}
                    type="button"
                  >
                    <TrashIcon />
                    <span>Delete comment</span>
                  </button>
                )}
                <button onClick={() => setMenuOpen(false)} style={menuItemStyle} type="button">
                  <LinkIcon />
                  <span>Copy link to comment</span>
                </button>
              </Stack>
            </Card>
          }
          open={menuOpen}
          placement="bottom-end"
          portal
        >
          <Tooltip content="Show more" placement="top" portal>
            <button
              onClick={() => setMenuOpen((value) => !value)}
              ref={menuTriggerRef}
              style={actionButtonStyle}
              type="button"
            >
              <MoreHorizontal size={14} />
            </button>
          </Tooltip>
        </Popover>
      </div>
    </div>
  )
}

export function EditCommentCard({comment, isReply, onCancel, onSave}: EditCommentCardProps) {
  const {data: users = []} = useUsers()
  const author = findUserByResourceUserId(comment.authorId, users)

  return (
    <Flex gap={3}>
      <Avatar
        alt={author?.profile?.displayName ?? 'Unknown'}
        size={isReply ? 0 : 1}
        src={author?.profile?.imageUrl ?? ''}
        style={{opacity: author?.profile?.imageUrl ? 1 : 0.25, flexShrink: 0, marginTop: 2}}
      />
      <div style={{flex: 1, minWidth: 0}}>
        <Flex align="baseline" gap={2}>
          <Text size={1} weight="semibold">
            {author?.profile?.displayName ?? 'Unknown'}
          </Text>
          <Text muted size={1}>
            {relativeTimeAgo(comment._createdAt)}
          </Text>
        </Flex>
        <div style={{marginTop: 8}}>
          <CommentInput
            autoFocus
            initialValue={comment.message}
            onCancel={onCancel}
            onSubmit={onSave}
            showSendButton
          />
        </div>
      </div>
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
  const currentUserId = useCurrentResourceUserId()

  const grouped = useMemo(() => {
    const map = new Map<string, {count: number; hasOwn: boolean; shortName: string}>()
    for (const reaction of reactions) {
      const entry = map.get(reaction.shortName) ?? {
        count: 0,
        hasOwn: false,
        shortName: reaction.shortName,
      }
      entry.count += 1
      if (reaction.userId === currentUserId) entry.hasOwn = true
      map.set(reaction.shortName, entry)
    }
    return Array.from(map.values())
  }, [currentUserId, reactions])

  if (grouped.length === 0) return null

  return (
    <Flex gap={1} style={{marginTop: 6, flexWrap: 'wrap'}}>
      {grouped.map(({count, hasOwn, shortName}) => (
        <button
          key={shortName}
          onClick={() => onReaction(commentId, shortName, reactions)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 999,
            border: '1px solid var(--card-border-color)',
            background: hasOwn ? 'rgba(59,130,246,0.08)' : 'var(--card-bg-color)',
            padding: '2px 6px',
            fontSize: 12,
            cursor: 'pointer',
          }}
          type="button"
        >
          <span>{EMOJI_MAP[shortName] ?? shortName}</span>
          <span>{count}</span>
        </button>
      ))}
    </Flex>
  )
}

function relativeTimeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'Just now'
  if (diff < hour) return `${Math.floor(diff / minute)} minutes ago`
  if (diff < day) return `${Math.floor(diff / hour)} hours ago`
  return `${Math.floor(diff / day)} days ago`
}

const actionButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  width: 24,
  height: 24,
  display: 'inline-flex',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--card-muted-fg-color)',
}

const menuItemStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: 8,
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
  padding: '6px 8px',
  textAlign: 'left',
  width: '100%',
}
