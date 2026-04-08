import {PortableText} from '@portabletext/react'
import {EditIcon, LinkIcon, TrashIcon} from '@sanity/icons'
import type {SanityUser} from '@sanity/sdk-react'
import {Box, Button, Card, Flex, Menu, MenuButton, MenuItem, Text, Tooltip} from '@sanity/ui'
import {CheckCircle2, MoreHorizontal, Undo2} from 'lucide-react'
import {useMemo, useState} from 'react'

import {
  commentHasMessage,
  relativeTimeAgo,
  renderAvatar,
} from '../../helpers/comments/sharedCommentsUtils'
import {findUserByResourceUserId} from '../../helpers/users/addonUserUtils'
import type {AddonMessage, CommentDocument, CommentReaction} from '../../types/addonTypes'
import {CommentInput} from './CommentInput'
import {SharedCommentsReactionBar, SharedCommentsReactionPicker} from './SharedCommentsReactions'

interface SharedCommentsItemProps {
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

interface SharedCommentsEditFormProps {
  comment: CommentDocument
  isReply?: boolean
  onCancel: () => void
  onSave: (message: AddonMessage) => void
  users: SanityUser[]
}

export function SharedCommentsItem({
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
}: SharedCommentsItemProps) {
  const author = findUserByResourceUserId(comment.authorId, users)
  const [hovered, setHovered] = useState(false)
  const [hasFocusWithin, setHasFocusWithin] = useState(false)
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
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
  const hasMessage = commentHasMessage(comment)

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
            <SharedCommentsReactionBar
              commentId={comment._id}
              onReaction={onReaction}
              reactions={reactions}
            />
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
        <SharedCommentsReactionPicker
          commentId={comment._id}
          onOpenChange={setReactionPickerOpen}
          onReaction={onReaction}
          reactions={reactions}
        />

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
          popover={{portal: false}}
        />
      </Card>
    </div>
  )
}

export function SharedCommentsEditForm({
  comment,
  isReply,
  onCancel,
  onSave,
  users,
}: SharedCommentsEditFormProps) {
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
