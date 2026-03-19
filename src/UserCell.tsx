import React, {useMemo} from 'react'
import {useUsers} from '@sanity/sdk-react'

interface UserCellProps {
  userId: string | null | undefined
  showName?: boolean | 'first'
}

/**
 * Renders a user avatar by resolving a userId via the SDK's useUsers() hook.
 * Shows initial + tooltip, optional name display.
 */
export function UserCell({userId, showName}: UserCellProps) {
  const {data: users = []} = useUsers()

  const resolvedUser = useMemo(() => {
    if (!userId) return null
    return users.find((user) => {
      const memberships = user.memberships as Array<{resourceUserId?: string}>
      return memberships?.some((m) => m.resourceUserId === userId)
    })
  }, [userId, users])

  if (!resolvedUser || !resolvedUser.profile?.displayName) {
    return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
  }

  const name = resolvedUser.profile.displayName
  const initial = name.charAt(0).toUpperCase()
  const imageUrl = resolvedUser.profile.imageUrl
  const displayName = showName === 'first' ? name.split(' ')[0] : name

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
      <div
        title={name}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: imageUrl ? 'transparent' : 'var(--card-badge-default-bg-color, #e3e4e8)',
          color: 'var(--card-badge-default-fg-color, #515e72)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 600,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%'}}
          />
        ) : (
          initial
        )}
      </div>
      {showName && (
        <span
          style={{
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </span>
      )}
    </div>
  )
}
