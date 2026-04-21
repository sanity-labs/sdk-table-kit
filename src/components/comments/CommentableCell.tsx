import React, {Suspense} from 'react'

import {useOptionalAddonData} from '../../context/AddonDataContext'
import type {CommentableCellProps} from '../../types/comments/commentableCellTypes'
import {CellDecoratorFrame} from '../table/CellDecoratorFrame'
import {CommentableCellInner} from './CommentableCellInner'

export function CommentableCell(props: CommentableCellProps) {
  const addonData = useOptionalAddonData()

  if (!addonData) {
    if (props.editedIndicatorTone) {
      return (
        <CellDecoratorFrame
          cellPadding={props.cellPadding}
          indicatorTone={props.editedIndicatorTone}
        >
          {props.children}
        </CellDecoratorFrame>
      )
    }

    return <>{props.children}</>
  }

  return (
    <Suspense fallback={<>{props.children}</>}>
      <CommentableCellInner {...props} />
    </Suspense>
  )
}
