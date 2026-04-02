import {Box, Card} from '@sanity/ui'
import type {Descendant} from 'slate'
import type {RenderElementProps} from 'slate-react'
import {Editable, Slate} from 'slate-react'

import type {CommentEditorInstance} from '../../types/comments/commentInputTypes'

export const COMMENT_INPUT_TEXT_STYLE = {
  fontFamily: 'inherit',
  fontSize: 14!,
  fontWeight: 400,
  lineHeight: '20px',
} as const

interface CommentInputEditorSurfaceProps {
  children?: React.ReactNode
  editor: CommentEditorInstance
  hasContent: boolean
  isEditorActive: boolean
  onBlur: () => void
  onChange: () => void
  onClick?: () => void
  onFocus: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onPaste: (event: React.ClipboardEvent) => void
  placeholder: string
  renderElement: (props: RenderElementProps) => React.ReactElement
  showSendButton?: boolean
}

export function CommentInputEditorSurface({
  children,
  editor,
  hasContent,
  isEditorActive,
  onBlur,
  onChange,
  onClick,
  onFocus,
  onKeyDown,
  onPaste,
  placeholder,
  renderElement,
  showSendButton,
}: CommentInputEditorSurfaceProps) {
  return (
    <Card
      padding={0}
      radius={2}
      shadow={1}
      style={{
        boxSizing: 'border-box',
        minWidth: 0,
        outline: isEditorActive ? '1px solid var(--card-focus-ring-color)' : undefined,
        overflowX: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Box style={{minWidth: 0, width: '100%'}}>
        <Slate editor={editor} initialValue={editor.children as Descendant[]} onChange={onChange}>
          <Editable
            onBlur={onBlur}
            onClick={onClick}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder=""
            renderElement={renderElement}
            role="textbox"
            style={{
              background: 'transparent',
              border: 'none',
              boxSizing: 'border-box',
              display: 'block',
              ...COMMENT_INPUT_TEXT_STYLE,
              maxWidth: '100%',
              minHeight: 40,
              minWidth: 0,
              outline: 'none',
              overflowWrap: 'anywhere',
              overflowX: 'hidden',
              padding: showSendButton ? '5px 12px 28px' : '5px 12px 8px',
              position: 'relative',
              whiteSpace: 'pre-wrap',
              width: '100%',
              wordBreak: 'break-word',
            }}
          />
        </Slate>

        {!hasContent && !isEditorActive && (
          <Box
            aria-hidden
            style={{
              ...COMMENT_INPUT_TEXT_STYLE,
              color: 'var(--card-muted-fg-color)',
              left: 12,
              pointerEvents: 'none',
              position: 'absolute',
              top: 5,
            }}
          >
            {placeholder}
          </Box>
        )}
      </Box>

      {children}
    </Card>
  )
}
