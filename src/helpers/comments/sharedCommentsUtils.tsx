import type {SanityUser} from '@sanity/sdk-react'

import type {CommentDocument} from '../../types/addonTypes'

export const REACTION_OPTIONS: Array<{emoji: string; shortName: string; title: string}> = [
  {emoji: '👍', shortName: ':+1:', title: 'Thumbs up'},
  {emoji: '👎', shortName: ':-1:', title: 'Thumbs down'},
  {emoji: '❤️', shortName: ':heart:', title: 'Heart'},
  {emoji: '🚀', shortName: ':rocket:', title: 'Rocket'},
  {emoji: '➕', shortName: ':heavy_plus_sign:', title: 'Plus'},
  {emoji: '👀', shortName: ':eyes:', title: 'Eyes'},
]

export const EMOJI_MAP: Record<string, string> = Object.fromEntries(
  REACTION_OPTIONS.map((reaction) => [reaction.shortName, reaction.emoji]),
)

export function commentHasMessage(comment: CommentDocument) {
  return (
    comment.message &&
    comment.message.length > 0 &&
    comment.message.some((block) =>
      block.children.some((child) => {
        if (child._type === 'span') return !!child.text?.trim()
        return child._type === 'mention'
      }),
    )
  )
}

export function getInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function relativeTimeAgo(isoDate: string | undefined): string {
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

export function renderAvatar(user: SanityUser | undefined, displayName: string, size: number) {
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
