import {Card} from '@sanity/ui'
import type {ReactNode} from 'react'

export function DefaultToneScope({children}: {children: ReactNode}) {
  return (
    <Card padding={0} radius={0} tone="default" style={{background: 'transparent'}}>
      {children}
    </Card>
  )
}
