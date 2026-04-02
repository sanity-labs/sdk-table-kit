import {
  Box,
  Button,
  Card,
  Flex,
  Popover,
  Text,
  Tooltip,
  useClickOutsideEvent,
  useGlobalKeyDown,
} from '@sanity/ui'
import {SmilePlus} from 'lucide-react'
import {useMemo, useRef, useState} from 'react'

import {EMOJI_MAP, REACTION_OPTIONS} from '../../helpers/comments/sharedCommentsUtils'
import {useCurrentResourceUserId} from '../../hooks/useCurrentResourceUserId'
import type {CommentReaction} from '../../types/addonTypes'

export function SharedCommentsReactionBar({
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

export function SharedCommentsReactionPicker({
  commentId,
  onReaction,
  onOpenChange,
  reactions,
}: {
  commentId: string
  onReaction: (commentId: string, shortName: string, reactions: CommentReaction[]) => void
  onOpenChange?: (open: boolean) => void
  reactions: CommentReaction[]
}) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const reactionPopoverRef = useRef<HTMLDivElement>(null)
  const reactionTriggerRef = useRef<HTMLButtonElement>(null)

  useClickOutsideEvent(
    reactionPickerOpen
      ? () => {
          setReactionPickerOpen(false)
          onOpenChange?.(false)
        }
      : undefined,
    () => [reactionPopoverRef.current, reactionTriggerRef.current],
  )

  useGlobalKeyDown((event) => {
    if (reactionPickerOpen && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setReactionPickerOpen(false)
      onOpenChange?.(false)
    }
  })

  return (
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
                  onReaction(commentId, option.shortName, reactions)
                  setReactionPickerOpen(false)
                  onOpenChange?.(false)
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
          onClick={() =>
            setReactionPickerOpen((value) => {
              const nextValue = !value
              onOpenChange?.(nextValue)
              return nextValue
            })
          }
          padding={2}
          ref={reactionTriggerRef}
        />
      </Tooltip>
    </Popover>
  )
}
