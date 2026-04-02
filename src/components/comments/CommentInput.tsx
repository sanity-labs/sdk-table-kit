import {Box} from '@sanity/ui'
import {forwardRef, useCallback} from 'react'
import type {RenderElementProps} from 'slate-react'

import {useCommentInputController} from '../../hooks/useCommentInputController'
import type {AddonMessage} from '../../types/addonTypes'
import type {CommentInputHandle} from '../../types/comments/commentInputHandle'
import type {CommentMentionElement} from '../../types/comments/commentInputTypes'
import {isCommentMentionElement} from '../../types/comments/commentInputTypes'
import {CommentInputEditorSurface} from './CommentInputEditorSurface'
import {CommentInputMentionsMenu} from './commentInputMentions'
import {CommentInputToolbar} from './CommentInputToolbar'
import {CommentInputMentionElement} from './CommentMentionElement'

export type {CommentInputHandle} from '../../types/comments/commentInputHandle'

interface CommentInputProps {
  autoFocus?: boolean
  initialValue?: AddonMessage
  onCancel?: () => void
  onSubmit?: (value: AddonMessage) => void
  placeholder?: string
  showSendButton?: boolean
}

export const CommentInput = forwardRef<CommentInputHandle, CommentInputProps>(function CommentInput(
  {autoFocus, initialValue, onCancel, onSubmit, placeholder = 'Add a comment...', showSendButton},
  ref,
) {
  const {
    closeMentions,
    cursorRect,
    editor,
    handleAtButton,
    handleEditorChange,
    handleFocus,
    handleKeyDown,
    handlePaste,
    handleSend,
    hasContent,
    insertMention,
    isEditorActive,
    mentionState,
    resolveMentionName,
    setIsFocused,
  } = useCommentInputController({
    autoFocus,
    initialValue,
    onCancel,
    onSubmit,
    ref,
  })

  const renderElement = useCallback(
    ({attributes, children, element}: RenderElementProps) => {
      if (isCommentMentionElement(element)) {
        return (
          <CommentInputMentionElement
            attributes={attributes}
            element={element as CommentMentionElement}
            resolveMentionName={resolveMentionName}
          >
            {children}
          </CommentInputMentionElement>
        )
      }

      return (
        <p
          {...attributes}
          style={{
            display: 'block',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            lineHeight: 'inherit',
            margin: 0,
            maxWidth: '100%',
            minWidth: 0,
            overflowWrap: 'anywhere',
            whiteSpace: 'pre-wrap',
            width: '100%',
            wordBreak: 'break-word',
          }}
        >
          {children}
        </p>
      )
    },
    [resolveMentionName],
  )

  return (
    <Box style={{minWidth: 0, position: 'relative', width: '100%'}}>
      <Box style={{minWidth: 0, position: 'relative', width: '100%'}}>
        <CommentInputEditorSurface
          editor={editor}
          hasContent={hasContent}
          isEditorActive={isEditorActive}
          onBlur={() => {
            setIsFocused(false)
            closeMentions()
          }}
          onChange={handleEditorChange}
          onClick={handleFocus}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          renderElement={renderElement}
          showSendButton={showSendButton}
        >
          {showSendButton && (
            <CommentInputToolbar
              hasContent={hasContent}
              onAddMention={handleAtButton}
              onSend={handleSend}
            />
          )}
        </CommentInputEditorSurface>

        {!!mentionState && cursorRect && (
          <CommentInputMentionsMenu
            cursorRect={cursorRect}
            onClose={closeMentions}
            onSelect={insertMention}
            searchTerm={mentionState.searchTerm}
          />
        )}
      </Box>
    </Box>
  )
})
