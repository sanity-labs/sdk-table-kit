import React, {Suspense} from 'react'

import {useOptionalAddonData} from '../../context/AddonDataContext'
import type {CommentableCellProps} from '../../types/comments/commentableCellTypes'
import {CommentableCellInner} from './CommentableCellInner'

export function CommentableCell(props: CommentableCellProps) {
  const addonData = useOptionalAddonData()

  if (!addonData) {
    return <>{props.children}</>
  }

  return (
    <Suspense fallback={<>{props.children}</>}>
      <CommentableCellInner {...props} />
    </Suspense>
  )
}
