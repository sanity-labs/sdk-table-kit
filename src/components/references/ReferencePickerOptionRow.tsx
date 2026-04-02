import type {DocumentHandle} from '@sanity/sdk'
import {useDocumentProjection} from '@sanity/sdk-react'
import type {PreviewConfig, PreviewValue} from '@sanity/types'
import {Box, Button, Card, Flex, Text} from '@sanity/ui'

import {OptionSkeleton} from './ReferencePickerSkeletons'

interface ReferencePickerOptionRowProps {
  handle: DocumentHandle
  isSelected: boolean
  onClick: (id: string, prepared?: PreviewValue) => void
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  projectionString: string
}

export function ReferencePickerOptionRow({
  handle,
  isSelected,
  onClick,
  preview,
  projectionString,
}: ReferencePickerOptionRowProps) {
  const {data, isPending} = useDocumentProjection<Record<string, unknown>>({
    ...handle,
    projection: projectionString as `{${string}}`,
  })

  if (isPending) {
    return <OptionSkeleton />
  }

  let prepared: PreviewValue
  try {
    const raw = (preview.prepare as (data: Record<string, unknown>) => PreviewValue)(
      (data as Record<string, unknown>) || {},
    )
    prepared = {
      ...raw,
      title: raw.title || handle.documentId || 'Untitled',
    }
  } catch {
    prepared = {title: handle.documentId || 'Untitled'}
  }

  const imgUrl =
    prepared.imageUrl ?? (typeof prepared.media === 'string' ? (prepared.media as string) : null)
  const title = prepared.title || 'Untitled'
  const initial = title.charAt(0).toUpperCase()

  return (
    <Card
      aria-selected={isSelected}
      as="div"
      onClick={() => onClick(handle.documentId, prepared)}
      padding={2}
      radius={0}
      role="option"
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid var(--card-border-color, #e3e4e8)',
      }}
      tone="default"
    >
      <Button mode="bleed" muted padding={2} radius={0} style={{width: '100%'}} tone="neutral">
        <Flex align="center" gap={2}>
          <Box
            style={{
              width: 32,
              height: 32,
              background: imgUrl ? 'transparent' : 'var(--card-badge-default-bg-color, #e3e4e8)',
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
            {imgUrl ? (
              <img
                alt={title}
                src={imgUrl}
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
