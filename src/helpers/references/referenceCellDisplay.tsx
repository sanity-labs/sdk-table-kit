import {AddIcon} from '@sanity/icons'
import type {PreviewValue} from '@sanity/types'
import {Box, Button, Card, Flex, Text} from '@sanity/ui'

export function isEmptyRef(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj._type === 'reference' && !obj._ref) return true
  return false
}

export function renderEmptyReferenceCell(placeholderText: string): React.ReactNode {
  return (
    <Card
      border
      data-testid="reference-empty-state"
      padding={1}
      radius={2}
      style={{width: '100%'}}
      tone="transparent"
    >
      <Button mode="bleed" muted padding={2} radius={0} style={{width: '100%'}} tone="neutral">
        <Flex align="center" gap={2}>
          <Box
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--card-badge-default-bg-color, #e3e4e8)',
              color: 'var(--card-badge-default-fg-color, #515e72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AddIcon />
          </Box>
          <Text muted size={1}>
            {placeholderText}
          </Text>
        </Flex>
      </Button>
    </Card>
  )
}

export function renderPreparedReference(prepared: PreviewValue): React.ReactNode {
  const title = prepared.title || '—'
  const initial = title.charAt(0).toUpperCase()
  const imageUrl = prepared.imageUrl ?? (typeof prepared.media === 'string' ? prepared.media : null)
  const hasMediaSlot = 'media' in prepared || 'imageUrl' in prepared
  const mediaSlotSize = 26

  if (!hasMediaSlot) {
    return (
      <Card border padding={1} radius={2} style={{width: '100%'}} tone="transparent">
        <Button mode="bleed" muted padding={2} radius={0} style={{width: '100%'}} tone="neutral">
          <Flex
            direction="column"
            gap={2}
            justify="center"
            style={{minHeight: mediaSlotSize, minWidth: 0}}
          >
            <Text size={1} textOverflow="ellipsis">
              {title}
            </Text>
            {prepared.subtitle && (
              <Text muted size={1} textOverflow="ellipsis">
                {prepared.subtitle}
              </Text>
            )}
          </Flex>
        </Button>
      </Card>
    )
  }

  return (
    <Card border padding={1} radius={2} style={{width: '100%'}} tone="transparent">
      <Button mode="bleed" muted padding={2} radius={0} style={{width: '100%'}} tone="neutral">
        <Flex align="center" gap={2}>
          <Box
            data-testid="reference-avatar"
            style={{
              width: mediaSlotSize,
              height: mediaSlotSize,
              background: imageUrl ? 'transparent' : 'var(--card-badge-default-bg-color, #e3e4e8)',
              color: 'var(--card-badge-default-fg-color, #515e72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 600,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {imageUrl ? (
              <img
                alt={title}
                src={imageUrl}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            ) : (
              initial
            )}
          </Box>
          <Flex direction="column" gap={2} style={{minWidth: 0}}>
            <Text size={1} textOverflow="ellipsis">
              {title}
            </Text>
            {prepared.subtitle && (
              <Text muted size={1} textOverflow="ellipsis">
                {prepared.subtitle}
              </Text>
            )}
          </Flex>
        </Flex>
      </Button>
    </Card>
  )
}

export function renderReferenceDisplay(
  value: unknown,
  prepare: (data: Record<string, unknown>) => PreviewValue,
): React.ReactNode {
  if (typeof value === 'string') {
    return <span>{value || '—'}</span>
  }

  if (typeof value === 'object' && value !== null) {
    try {
      const prepared = prepare(value as Record<string, unknown>)
      return renderPreparedReference(prepared)
    } catch {
      return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
    }
  }

  return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
}
