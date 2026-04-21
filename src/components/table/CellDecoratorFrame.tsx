import type {ReactNode} from 'react'

import type {EditedFieldIndicatorTone} from '../../helpers/releases/perspectiveTones'

interface CellDecoratorFrameProps {
  cellPadding: {x: number; y: number}
  children: ReactNode
  contentTestId?: string
  indicatorTone?: EditedFieldIndicatorTone
  trailing?: ReactNode
}

const INDICATOR_COLOR_BY_TONE: Record<EditedFieldIndicatorTone, string> = {
  default: 'var(--card-badge-default-icon-color, #515e72)',
  positive: 'var(--card-badge-positive-icon-color, #18794e)',
  caution: 'var(--card-badge-caution-icon-color, #7d4b00)',
  suggest: 'var(--card-badge-suggest-icon-color, #6b46c1)',
}

export function CellDecoratorFrame({
  cellPadding,
  children,
  contentTestId,
  indicatorTone,
  trailing,
}: CellDecoratorFrameProps) {
  return (
    <div
      data-edited-field={indicatorTone ? 'true' : undefined}
      data-edited-tone={indicatorTone}
      style={{
        alignSelf: 'stretch',
        alignItems: 'center',
        boxShadow: indicatorTone
          ? `inset 0 -3px 0 ${INDICATOR_COLOR_BY_TONE[indicatorTone]}`
          : undefined,
        display: 'flex',
        flex: 1,
        margin: `${cellPadding.y * -1}px ${cellPadding.x * -1}px`,
        minHeight: `calc(100% + ${cellPadding.y * 2}px)`,
        minWidth: 0,
        padding: `${cellPadding.y}px ${cellPadding.x}px`,
        position: 'relative',
        width: `calc(100% + ${cellPadding.x * 2}px)`,
      }}
    >
      <div
        data-testid={contentTestId}
        style={{
          alignItems: 'center',
          display: 'flex',
          flex: 1,
          minHeight: '100%',
          minWidth: 0,
          width: '100%',
        }}
      >
        {children}
      </div>
      {trailing}
    </div>
  )
}
