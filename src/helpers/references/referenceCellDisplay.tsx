import {TableCellChrome} from '@sanetti/sanity-table-kit'
import {AddIcon} from '@sanity/icons'
import type {PreviewValue} from '@sanity/types'
import {Box, Text} from '@sanity/ui'

export function isEmptyRef(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj._type === 'reference' && !obj._ref) return true
  return false
}

export function renderEmptyReferenceCell(
  placeholderText: string,
  onPress?: () => void,
): React.ReactNode {
  return (
    <TableCellChrome
      dataTestId="reference-empty-state"
      leading={
        <Box
          style={{
            alignItems: 'center',
            background: 'var(--card-badge-default-bg-color, #e3e4e8)',
            borderRadius: '50%',
            color: 'var(--card-badge-default-fg-color, #515e72)',
            display: 'flex',
            flexShrink: 0,
            height: 24,
            justifyContent: 'center',
            width: 24,
          }}
        >
          <AddIcon />
        </Box>
      }
      onPress={onPress}
      state="empty"
      title={
        <Text muted size={1}>
          {placeholderText}
        </Text>
      }
    />
  )
}

export function renderPreparedReference(
  prepared: PreviewValue,
  onPress?: () => void,
): React.ReactNode {
  const title = prepared.title || '—'
  const initial = title.charAt(0).toUpperCase()
  const imageUrl = prepared.imageUrl ?? (typeof prepared.media === 'string' ? prepared.media : null)
  const hasMediaSlot = 'media' in prepared || 'imageUrl' in prepared
  const mediaSlotSize = 26

  return (
    <TableCellChrome
      leading={
        hasMediaSlot ? (
          <Box
            data-testid="reference-avatar"
            style={{
              alignItems: 'center',
              background: imageUrl ? 'transparent' : 'var(--card-badge-default-bg-color, #e3e4e8)',
              color: 'var(--card-badge-default-fg-color, #515e72)',
              display: 'flex',
              flexShrink: 0,
              fontSize: '11px',
              fontWeight: 600,
              height: mediaSlotSize,
              justifyContent: 'center',
              overflow: 'hidden',
              width: mediaSlotSize,
            }}
          >
            {imageUrl ? (
              <img
                alt={title}
                src={imageUrl}
                style={{height: '100%', objectFit: 'cover', width: '100%'}}
              />
            ) : (
              initial
            )}
          </Box>
        ) : undefined
      }
      onPress={onPress}
      state="filled"
      subtitle={
        prepared.subtitle ? (
          <Text muted size={1} textOverflow="ellipsis">
            {prepared.subtitle}
          </Text>
        ) : undefined
      }
      title={
        <Text size={1} textOverflow="ellipsis">
          {title}
        </Text>
      }
    />
  )
}

export function renderReferenceDisplay(
  value: unknown,
  prepare: (data: Record<string, unknown>) => PreviewValue,
  onPress?: () => void,
): React.ReactNode {
  if (typeof value === 'string') {
    if (!onPress) return <span>{value || '—'}</span>

    return (
      <TableCellChrome
        onPress={onPress}
        state="filled"
        title={
          <Text size={1} textOverflow="ellipsis">
            {value || '—'}
          </Text>
        }
      />
    )
  }

  if (typeof value === 'object' && value !== null) {
    try {
      const prepared = prepare(value as Record<string, unknown>)
      return renderPreparedReference(prepared, onPress)
    } catch {
      if (onPress) {
        return (
          <TableCellChrome
            onPress={onPress}
            state="filled"
            title={
              <Text muted size={1}>
                —
              </Text>
            }
          />
        )
      }
      return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
    }
  }

  if (onPress) {
    return (
      <TableCellChrome
        onPress={onPress}
        state="filled"
        title={
          <Text muted size={1}>
            —
          </Text>
        }
      />
    )
  }

  return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
}
