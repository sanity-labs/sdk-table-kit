import {Badge, Card, Flex, Text} from '@sanity/ui'
import React from 'react'

import {useReleaseContext} from './ReleaseContext'

type ReleaseType = 'asap' | 'scheduled' | 'undecided'

const TONE_MAP: Record<ReleaseType, 'caution' | 'suggest' | 'neutral'> = {
  asap: 'caution',
  scheduled: 'suggest',
  undecided: 'neutral',
}

export function ReleaseHeader({children}: {children?: React.ReactNode}) {
  const {selectedRelease} = useReleaseContext()
  const releaseType = selectedRelease?.metadata.releaseType

  const tone = releaseType ? TONE_MAP[releaseType] : undefined

  return (
    <Card tone={tone} padding={3} data-testid="release-header">
      <Flex align="center" gap={3}>
        {selectedRelease ? (
          <>
            <Text weight="semibold">{selectedRelease.metadata.title ?? selectedRelease.name}</Text>
            {releaseType && <Badge tone={tone}>{releaseType.toUpperCase()}</Badge>}
          </>
        ) : (
          <Text weight="semibold">Drafts</Text>
        )}
      </Flex>
      {children}
    </Card>
  )
}
