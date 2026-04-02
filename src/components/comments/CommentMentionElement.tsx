import {createElement, type ReactNode} from 'react'
import type {RenderElementProps} from 'slate-react'

import type {CommentMentionElement} from '../../types/comments/commentInputTypes'

export function CommentInputMentionElement({
  attributes,
  children,
  element,
  resolveMentionName,
}: {
  attributes: RenderElementProps['attributes']
  element: CommentMentionElement
  resolveMentionName: (userId: string) => string
  children: ReactNode
}) {
  return createElement(
    'span',
    {
      ...attributes,
      contentEditable: false,
      'data-mention-user-id': element.userId,
      style: {
        alignItems: 'center',
        borderRadius: '4px',
        color: '#2563eb',
        display: 'inline-flex',
        fontWeight: 600,
        padding: '0 2px',
      },
    },
    children,
    createElement('span', null, `@${resolveMentionName(element.userId)}`),
  )
}
