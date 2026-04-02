import {Box, Card, Flex} from '@sanity/ui'
import {forwardRef} from 'react'
import type {CSSProperties, HTMLAttributes, ReactNode} from 'react'

export interface ActionBarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  placement?: {
    bottom?: number
    left?: number
    right?: number
    top?: number
  }
  style?: CSSProperties
  visible?: boolean
}

export const ActionBar = forwardRef<HTMLDivElement, ActionBarProps>(function ActionBar(
  {children, placement, style, visible = true, ...props},
  ref,
) {
  const resolvedPlacement = {
    right: 8,
    top: 8,
    ...placement,
  }

  return (
    <Box
      {...props}
      ref={ref}
      style={{
        ...resolvedPlacement,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        position: 'absolute',
        transition: 'opacity 120ms ease',
        zIndex: 1,
        ...style,
      }}
    >
      <Card padding={1} radius={2} shadow={2}>
        <Flex align="center" gap={1}>
          {children}
        </Flex>
      </Card>
    </Box>
  )
})
