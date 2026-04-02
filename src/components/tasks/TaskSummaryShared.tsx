import {LaunchIcon, TrashIcon} from '@sanity/icons'
import type {SanityUser} from '@sanity/sdk-react'
import {Box, Button, Flex, Menu, MenuButton, MenuItem, Stack, Text} from '@sanity/ui'
import {MoreHorizontal} from 'lucide-react'
import React from 'react'

import {getInitials} from '../../helpers/tasks/TaskSummaryUtils'

export const addCircleStyle: React.CSSProperties = {
  alignItems: 'center',
  background: 'var(--card-badge-default-bg-color, #e3e4e8)',
  borderRadius: '50%',
  color: 'var(--card-badge-default-fg-color, #515e72)',
  display: 'flex',
  flexShrink: 0,
  height: 24,
  justifyContent: 'center',
  width: 24,
}

export function TaskActionsMenu({onDelete, studioUrl}: {onDelete: () => void; studioUrl: string}) {
  return (
    <MenuButton
      button={<Button icon={<MoreHorizontal size={16} />} mode="bleed" padding={2} />}
      menu={
        <Menu>
          <MenuItem
            icon={LaunchIcon}
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open(studioUrl, '_blank', 'noopener,noreferrer')
              }
            }}
            text="Open task in Studio"
          />
          <MenuItem icon={TrashIcon} onClick={onDelete} text="Delete task" tone="critical" />
        </Menu>
      }
      popover={{portal: true}}
    />
  )
}

export function InlineIconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        alignItems: 'center',
        background: 'transparent',
        border: 0,
        borderRadius: 6,
        color: 'var(--card-muted-fg-color)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        padding: 4,
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

export const TaskMetadataChip = React.forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode
    onClick: () => void
    tone?: 'critical' | 'default'
  }
>(function TaskMetadataChip({children, onClick, tone = 'default'}, ref) {
  return (
    <button
      onClick={onClick}
      ref={ref}
      style={{
        alignItems: 'center',
        background: tone === 'critical' ? 'rgba(220, 38, 38, 0.08)' : 'var(--card-bg-color)',
        border: `1px solid ${tone === 'critical' ? 'rgba(220, 38, 38, 0.18)' : 'var(--card-border-color)'}`,
        borderRadius: 6,
        color: tone === 'critical' ? 'var(--card-critical-fg-color)' : 'inherit',
        cursor: 'pointer',
        display: 'flex',
        gap: 6,
        minHeight: 32,
        padding: '6px 10px',
      }}
      type="button"
    >
      {children}
    </button>
  )
})

export function TaskListMetaPill({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'caution' | 'default'
}) {
  return (
    <Flex
      align="center"
      gap={1}
      style={{
        background: tone === 'caution' ? 'rgba(234, 179, 8, 0.12)' : 'var(--card-bg-color)',
        border: `1px solid ${tone === 'caution' ? 'rgba(234, 179, 8, 0.2)' : 'var(--card-border-color)'}`,
        borderRadius: 999,
        padding: '4px 8px',
      }}
    >
      {children}
    </Flex>
  )
}

export function TaskSection({
  children,
  count,
  title,
  tone = 'default',
}: {
  children: React.ReactNode
  count: number
  title: string
  tone?: 'critical' | 'default'
}) {
  return (
    <Stack space={2}>
      <Text
        muted={tone === 'default'}
        size={1}
        weight="semibold"
        style={{
          color: tone === 'critical' ? 'var(--card-critical-fg-color)' : undefined,
          letterSpacing: '0.04em',
        }}
      >
        {title} ({count})
      </Text>
      <Stack space={2}>{children}</Stack>
    </Stack>
  )
}

export function TaskUserAvatar({user}: {user: SanityUser}) {
  const displayName = user.profile?.displayName ?? '?'
  const initials = getInitials(displayName)

  return (
    <Box
      style={{
        alignItems: 'center',
        background: 'var(--card-badge-default-bg-color, #e3e4e8)',
        borderRadius: '50%',
        color: 'var(--card-badge-default-fg-color, #515e72)',
        display: 'flex',
        height: 18,
        justifyContent: 'center',
        overflow: 'hidden',
        width: 18,
      }}
    >
      {user.profile?.imageUrl ? (
        <img
          alt={displayName}
          src={user.profile.imageUrl}
          style={{display: 'block', height: '100%', objectFit: 'cover', width: '100%'}}
        />
      ) : (
        <Text size={0} weight="semibold">
          {initials}
        </Text>
      )}
    </Box>
  )
}
