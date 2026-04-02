import {useUsers} from '@sanity/sdk-react'
import {useCallback, useEffect, useImperativeHandle, useState} from 'react'
import {createEditor, Editor, Transforms, type Descendant, type Range} from 'slate'
import {ReactEditor, withReact} from 'slate-react'

import {getMentionSearch} from '../components/comments/commentInputMentions'
import {
  addonMessageToSlateValue,
  createEmptyEditorValue,
  createMentionNode,
  editorHasContent,
  replaceEditorValue,
  slateValueToAddonMessage,
  withMentions,
} from '../helpers/comments/commentInputSlate'
import {findUserByResourceUserId} from '../helpers/users/addonUserUtils'
import type {AddonMessage} from '../types/addonTypes'
import type {CommentInputHandle} from '../types/comments/commentInputHandle'
import type {CommentEditorInstance} from '../types/comments/commentInputTypes'

interface UseCommentInputControllerArgs {
  autoFocus?: boolean
  initialValue?: AddonMessage
  onCancel?: () => void
  onSubmit?: (value: AddonMessage) => void
  ref: React.ForwardedRef<CommentInputHandle>
}

export function useCommentInputController({
  autoFocus,
  initialValue,
  onCancel,
  onSubmit,
  ref,
}: UseCommentInputControllerArgs) {
  const {data: users = []} = useUsers()
  const [editor] = useState<CommentEditorInstance>(() => {
    const nextEditor = withMentions(withReact(createEditor()) as CommentEditorInstance)
    nextEditor.children = addonMessageToSlateValue(initialValue ?? null)
    return nextEditor
  })
  const [editorVersion, setEditorVersion] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const [mentionState, setMentionState] = useState<null | {searchTerm: string; target: Range}>(null)
  const [cursorRect, setCursorRect] = useState<DOMRect | null>(null)

  const resolveMentionName = useCallback(
    (userId: string) => {
      const user = findUserByResourceUserId(userId, users)
      return user?.profile?.displayName ?? userId
    },
    [users],
  )

  useEffect(() => {
    replaceEditorValue(editor, addonMessageToSlateValue(initialValue ?? null))
    setEditorVersion((prev) => prev + 1)
  }, [editor, initialValue])

  useEffect(() => {
    if (!autoFocus) return

    queueMicrotask(() => {
      ReactEditor.focus(editor)
      Transforms.select(editor, Editor.end(editor, []))
    })
  }, [autoFocus, editor])

  useEffect(() => {
    if (!mentionState) {
      setCursorRect(null)
      return
    }

    try {
      const domRange = ReactEditor.toDOMRange(editor, mentionState.target)
      setCursorRect(domRange.getBoundingClientRect())
    } catch {
      // JSDOM can't always resolve Slate selections to a DOM range. Fall back
      // to a neutral rect so the mentions menu can still render.
      setCursorRect(new DOMRect(0, 0, 0, 0))
    }
  }, [editor, editorVersion, mentionState])

  const closeMentions = useCallback(() => {
    setMentionState(null)
  }, [])

  const updateMentionSearch = useCallback(() => {
    setMentionState(getMentionSearch(editor))
  }, [editor])

  const getValue = useCallback((): AddonMessage => {
    return slateValueToAddonMessage(editor.children as Descendant[])
  }, [editor])

  const isEmpty = useCallback((): boolean => !getValue(), [getValue])

  const clearEditor = useCallback(() => {
    replaceEditorValue(editor, createEmptyEditorValue())
    closeMentions()
    setEditorVersion((prev) => prev + 1)
  }, [closeMentions, editor])

  useImperativeHandle(
    ref,
    () => ({
      clear: clearEditor,
      focus: () => {
        ReactEditor.focus(editor)
        Transforms.select(editor, Editor.end(editor, []))
      },
      getValue,
      isEmpty,
    }),
    [clearEditor, editor, getValue, isEmpty],
  )

  const insertMention = useCallback(
    (userId: string) => {
      if (!mentionState) {
        closeMentions()
        return
      }

      ReactEditor.focus(editor)
      Transforms.select(editor, mentionState.target)
      Transforms.insertNodes(editor, [createMentionNode(userId), {text: ' '}])
      Transforms.collapse(editor, {edge: 'end'})
      ReactEditor.focus(editor)
      closeMentions()
      setEditorVersion((prev) => prev + 1)
    },
    [closeMentions, editor, mentionState],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (mentionState) {
        if (event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          closeMentions()
          return
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
          event.preventDefault()
          return
        }
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (!isEmpty() && onSubmit) {
          onSubmit(getValue())
        }
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        return
      }

      if (event.key === 'Escape' && onCancel) {
        onCancel()
      }
    },
    [closeMentions, getValue, isEmpty, mentionState, onCancel, onSubmit],
  )

  const handleSend = useCallback(() => {
    if (!isEmpty() && onSubmit) {
      onSubmit(getValue())
    }
  }, [getValue, isEmpty, onSubmit])

  const handleAtButton = useCallback(() => {
    ReactEditor.focus(editor)
    if (!editor.selection) {
      Transforms.select(editor, Editor.end(editor, []))
    }

    Transforms.insertText(editor, '@')
    const nextMentionSearch = getMentionSearch(editor)

    if (nextMentionSearch) {
      setMentionState(nextMentionSearch)
    } else if (editor.selection) {
      const focus = editor.selection.anchor
      const anchor = Editor.before(editor, focus, {unit: 'character'}) ?? focus

      setMentionState({
        searchTerm: '',
        target: {anchor, focus},
      })
    } else {
      updateMentionSearch()
    }

    setEditorVersion((prev) => prev + 1)
  }, [editor, updateMentionSearch])

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault()
      const text = event.clipboardData.getData('text/plain')
      Transforms.insertText(editor, text.replace(/[\r\n]+/g, ' '))
    },
    [editor],
  )

  return {
    closeMentions,
    cursorRect,
    editor,
    handleAtButton,
    handleEditorChange: () => {
      setEditorVersion((prev) => prev + 1)
      updateMentionSearch()
    },
    handleFocus: () => setIsFocused(true),
    handleKeyDown,
    handlePaste,
    handleSend,
    hasContent: editorHasContent(editor.children as Descendant[]),
    insertMention,
    isEditorActive: isFocused || !!mentionState,
    mentionState,
    resolveMentionName,
    setIsFocused,
  }
}
