import {Card, Popover} from '@sanity/ui'

interface FilterPopoverProps {
  animate?: boolean
  children: React.ReactElement
  content: React.ReactNode
  minWidth?: number
  open: boolean
}

export function FilterPopover({animate, children, content, minWidth, open}: FilterPopoverProps) {
  return (
    <Popover
      animate={animate ?? true}
      content={
        <Card padding={2} radius={3} tone="default" style={minWidth ? {minWidth} : undefined}>
          {content}
        </Card>
      }
      open={open}
      placement="bottom-start"
      portal
    >
      {children}
    </Popover>
  )
}
