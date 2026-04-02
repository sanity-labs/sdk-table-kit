import type {SanityUser} from '@sanity/sdk-react'
import {useUsers} from '@sanity/sdk-react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {deburr} from 'lodash-es'
import {useEffect, useMemo, useState} from 'react'
import {createPortal} from 'react-dom'
import {Editor, type Path, Range, Text as SlateText} from 'slate'

import {getResourceUserId} from '../../helpers/users/addonUserUtils'
import type {CommentEditorInstance} from '../../types/comments/commentInputTypes'

export function findMentionTrigger(text: string, cursorOffset: number): number {
  const beforeCursor = text.slice(0, cursorOffset)
  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    if (beforeCursor[i] === '@') {
      const charBefore = i > 0 ? beforeCursor[i - 1] : undefined
      if (!charBefore || charBefore === ' ' || charBefore === '\u00A0') {
        return i
      }
      return -1
    }
  }
  return -1
}

export function getMentionSearch(editor: CommentEditorInstance): null | {
  searchTerm: string
  target: Range
} {
  const {selection} = editor
  if (!selection || !Range.isCollapsed(selection)) return null

  const [leaf, path] = Editor.leaf(editor, selection.anchor)
  if (!SlateText.isText(leaf)) return null

  const cursorOffset = selection.anchor.offset
  const atIndex = findMentionTrigger(leaf.text, cursorOffset)
  if (atIndex < 0) return null

  const searchTerm = leaf.text.slice(atIndex + 1, cursorOffset)
  if (searchTerm.includes(' ') || searchTerm.includes('\u00A0')) return null

  return {
    searchTerm,
    target: {
      anchor: {offset: atIndex, path: path as Path},
      focus: selection.anchor,
    },
  }
}

function getInitials(displayName?: string): string {
  return (displayName ?? '?')
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function renderAvatar(user: SanityUser | undefined, displayName: string) {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: user?.profile?.imageUrl
          ? 'transparent'
          : 'var(--card-badge-default-bg-color, #e3e4e8)',
        color: 'var(--card-badge-default-fg-color, #515e72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '7px',
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

interface CommentInputMentionsMenuProps {
  cursorRect: DOMRect
  onClose: () => void
  onSelect: (userId: string) => void
  searchTerm: string
}

export function CommentInputMentionsMenu({
  cursorRect,
  onClose,
  onSelect,
  searchTerm,
}: CommentInputMentionsMenuProps) {
  const {data: users = []} = useUsers()
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users

    const term = deburr(searchTerm).toLocaleLowerCase()
    return users
      .filter((user) => {
        const name = deburr(user.profile?.displayName ?? '').toLocaleLowerCase()
        return name.includes(term)
      })
      .sort((a, b) => {
        const aName = deburr(a.profile?.displayName ?? '').toLocaleLowerCase()
        const bName = deburr(b.profile?.displayName ?? '').toLocaleLowerCase()
        const aStarts = aName.startsWith(term)
        const bStarts = bName.startsWith(term)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return 0
      })
  }, [searchTerm, users])

  useEffect(() => {
    setActiveIndex(0)
  }, [filteredUsers.length])

  const popoverStyle = useMemo(() => {
    const menuWidth = 224
    const viewportPadding = 8
    const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
    const left = Math.min(Math.max(cursorRect.left, viewportPadding), maxLeft)

    return {
      left,
      position: 'fixed' as const,
      top: Math.min(cursorRect.bottom + 4, window.innerHeight - 200),
      zIndex: 2000,
    }
  }, [cursorRect])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (filteredUsers[activeIndex]) {
          const userId =
            getResourceUserId(filteredUsers[activeIndex]) ?? filteredUsers[activeIndex].sanityUserId
          onSelect(userId)
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [activeIndex, filteredUsers, onClose, onSelect])

  if (filteredUsers.length === 0) {
    return createPortal(
      <Card padding={2} radius={2} shadow={2} style={{...popoverStyle, width: 224}}>
        <Text muted size={1}>
          No users found
        </Text>
      </Card>,
      document.body,
    )
  }

  return createPortal(
    <Card
      padding={1}
      radius={2}
      role="listbox"
      shadow={3}
      style={{
        ...popoverStyle,
        maxHeight: 192,
        overflowY: 'auto',
        width: 224,
      }}
    >
      <Stack space={1}>
        {filteredUsers.map((user, index) => {
          const userId = getResourceUserId(user) ?? user.sanityUserId
          const displayName = user.profile?.displayName ?? 'Unknown'
          const isActive = index === activeIndex

          return (
            <Button
              fontSize={1}
              justify="flex-start"
              key={userId}
              mode={isActive ? 'default' : 'bleed'}
              onClick={() => onSelect(userId)}
              onMouseEnter={() => setActiveIndex(index)}
              padding={2}
              style={{transition: 'none'}}
              text={
                <Flex align="center" gap={2}>
                  {renderAvatar(user, displayName)}
                  <Text size={1} style={{maxWidth: 150}} textOverflow="ellipsis">
                    {displayName}
                  </Text>
                </Flex>
              }
              tone={isActive ? 'primary' : 'default'}
            />
          )
        })}
      </Stack>
    </Card>,
    document.body,
  )
}
