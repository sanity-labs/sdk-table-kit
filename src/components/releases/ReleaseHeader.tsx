import {Badge, Card, Flex, Text} from '@sanity/ui'
import React from 'react'

import {useReleaseContext} from '../../context/ReleaseContext'

type ReleaseType = 'asap' | 'scheduled' | 'undecided'

const TONE_MAP: Record<ReleaseType, 'caution' | 'suggest' | 'neutral'> = {
  asap: 'caution',
  scheduled: 'suggest',
  undecided: 'neutral',
}

export function ReleaseHeader({children}: {children?: React.ReactNode}) {
  const {selectedRelease} = useReleaseContext()
  const releaseType = selectedRelease?.metadata.releaseType
  const targetLabel = selectedRelease
    ? (selectedRelease.metadata.title ?? selectedRelease.name)
    : 'Drafts'

  const tone = releaseType ? TONE_MAP[releaseType] : undefined

  return (
    <Card tone={tone} padding={3} data-testid="release-header">
      <Flex align="center" gap={3}>
        <Text weight="semibold">{`Staging to ${targetLabel}`}</Text>
        {releaseType && <Badge tone={tone}>{releaseType.toUpperCase()}</Badge>}
      </Flex>
      {children}
    </Card>
  )
}
