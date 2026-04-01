import type {SanityUser} from '@sanity/sdk-react'
import {useUsers} from '@sanity/sdk-react'
import {Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {deburr} from 'lodash-es'
import {Send} from 'lucide-react'
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {createPortal} from 'react-dom'
import {
  BaseEditor,
  createEditor,
  Editor,
  Element as SlateElement,
  type Descendant,
  type Path,
  Range,
  Text as SlateText,
  Transforms,
} from 'slate'
import {Editable, type RenderElementProps, ReactEditor, Slate, withReact} from 'slate-react'

import type {AddonMessage} from './addonTypes'
import {findUserByResourceUserId, getResourceUserId} from './addonUserUtils'

export interface CommentInputHandle {
  clear: () => void
  focus: () => void
  getValue: () => AddonMessage
  isEmpty: () => boolean
}

interface CommentInputProps {
  autoFocus?: boolean
  initialValue?: AddonMessage
  onCancel?: () => void
  onSubmit?: (value: AddonMessage) => void
  placeholder?: string
  showSendButton?: boolean
}

type CommentEditorText = {text: string}

interface CommentMentionElement {
  children: [CommentEditorText]
  type: 'mention'
  userId: string
}

interface CommentParagraphElement {
  children: Array<CommentEditorText | CommentMentionElement>
  type: 'paragraph'
}

function generateKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function createEmptyEditorValue(): Descendant[] {
  return [
    {
      children: [{text: ''}],
      type: 'paragraph',
    } as unknown as Descendant,
  ]
}

function createMentionNode(userId: string): CommentMentionElement {
  return {
    children: [{text: ''}],
    type: 'mention',
    userId,
  }
}

function getInitials(displayName?: string): string {
  return (displayName ?? '?')
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function addonMessageToSlateValue(value: AddonMessage): Descendant[] {
  if (!value || value.length === 0) {
    return createEmptyEditorValue()
  }

  const blocks = value.map<CommentParagraphElement>((block) => {
    const children = block.children.reduce<Array<CommentEditorText | CommentMentionElement>>(
      (acc, child) => {
        if (child._type === 'mention') {
          acc.push(createMentionNode(child.userId))
        } else {
          acc.push({text: child.text ?? ''})
        }

        return acc
      },
      [],
    )

    return {
      children: children.length > 0 ? children : [{text: ''}],
      type: 'paragraph',
    }
  })

  return blocks.length > 0 ? blocks : createEmptyEditorValue()
}

function slateValueToAddonMessage(value: Descendant[]): AddonMessage {
  const blocks: NonNullable<AddonMessage> = []

  for (const node of value) {
    if (!isCommentParagraphElement(node)) continue

    const children: NonNullable<AddonMessage>[0]['children'] = []
    for (const child of node.children) {
      if (isCommentMentionElement(child)) {
        children.push({_key: generateKey(), _type: 'mention', userId: child.userId})
      } else if (SlateText.isText(child) && child.text) {
        children.push({_key: generateKey(), _type: 'span', text: child.text})
      }
    }

    blocks.push({
      _key: generateKey(),
      _type: 'block',
      children: children.length > 0 ? children : [{_key: generateKey(), _type: 'span', text: ''}],
      markDefs: [],
      style: 'normal',
    })
  }

  const hasContent = blocks.some((block) =>
    block.children.some((child) => child._type === 'mention' || !!child.text.trim()),
  )

  return hasContent ? blocks : null
}

function findMentionTrigger(text: string, cursorOffset: number): number {
  const beforeCursor = text.slice(0, cursorOffset)
  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    if (beforeCursor[i] === '@') {
      const charBefore = i > 0 ? beforeCursor[i - 1] : undefined
      if (!charBefore || charBefore === ' ' || charBefore === '\u00A0') {
        return i
      }
      return -1
    }
  }
  return -1
}

function isCommentMentionElement(value: unknown): value is CommentMentionElement {
  return (
    SlateElement.isElement(value) &&
    'type' in value &&
    value.type === 'mention' &&
    'userId' in value
  )
}

function isCommentParagraphElement(value: unknown): value is CommentParagraphElement {
  return SlateElement.isElement(value) && 'type' in value && value.type === 'paragraph'
}

function withMentions(editor: BaseEditor & ReactEditor): BaseEditor & ReactEditor {
  const {isInline, isVoid} = editor

  editor.isInline = (element) => {
    return isCommentMentionElement(element) ? true : isInline(element)
  }

  editor.isVoid = (element) => {
    return isCommentMentionElement(element) ? true : isVoid(element)
  }

  return editor
}

function replaceEditorValue(editor: BaseEditor & ReactEditor, value: Descendant[]) {
  editor.children = value
  const end = Editor.end(editor, [])
  editor.selection = {anchor: end, focus: end}
  editor.onChange()
}

function getMentionSearch(editor: BaseEditor & ReactEditor): null | {
  searchTerm: string
  target: Range
} {
  const {selection} = editor
  if (!selection || !Range.isCollapsed(selection)) return null

  const [leaf, path] = Editor.leaf(editor, selection.anchor)
  if (!SlateText.isText(leaf)) return null

  const cursorOffset = selection.anchor.offset
  const atIndex = findMentionTrigger(leaf.text, cursorOffset)
  if (atIndex < 0) return null

  const searchTerm = leaf.text.slice(atIndex + 1, cursorOffset)
  if (searchTerm.includes(' ') || searchTerm.includes('\u00A0')) return null

  return {
    searchTerm,
    target: {
      anchor: {offset: atIndex, path: path as Path},
      focus: selection.anchor,
    },
  }
}

function editorHasContent(value: Descendant[]): boolean {
  return value.some((node) => {
    if (!isCommentParagraphElement(node)) return false

    return node.children.some((child) => {
      if (isCommentMentionElement(child)) return true
      return SlateText.isText(child) && !!child.text.trim()
    })
  })
}

const COMMENT_INPUT_TEXT_STYLE = {
  fontFamily: 'inherit',
  fontSize: 14!,
  fontWeight: 400,
  lineHeight: '20px',
} as const

export const CommentInput = forwardRef<CommentInputHandle, CommentInputProps>(function CommentInput(
  {autoFocus, initialValue, onCancel, onSubmit, placeholder = 'Add a comment...', showSendButton},
  ref,
) {
  const {data: users = []} = useUsers()
  const rootRef = useRef<HTMLDivElement>(null)
  const [editor] = useState(() => {
    const nextEditor = withMentions(withReact(createEditor()))
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
      setCursorRect(null)
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
    updateMentionSearch()
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

  const hasContent = editorHasContent(editor.children as Descendant[])
  const isEditorActive = isFocused || !!mentionState

  const renderElement = useCallback(
    ({attributes, children, element}: RenderElementProps) => {
      if (isCommentMentionElement(element)) {
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
          <Box ref={rootRef} style={{minWidth: 0, width: '100%'}}>
            <Slate
              editor={editor}
              initialValue={editor.children as Descendant[]}
              onChange={() => {
                setEditorVersion((prev) => prev + 1)
                updateMentionSearch()
              }}
            >
              <Editable
                onBlur={() => {
                  setIsFocused(false)
                  closeMentions()
                }}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={!hasContent ? placeholder : ''}
                renderPlaceholder={({attributes, children}) => (
                  <span
                    {...attributes}
                    style={{
                      ...COMMENT_INPUT_TEXT_STYLE,
                      color: 'var(--card-muted-fg-color)',
                      left: 12,
                      pointerEvents: 'none',
                      position: 'absolute',
                      top: 5,
                    }}
                  >
                    {children}
                  </span>
                )}
                renderElement={renderElement}
                role="textbox"
                style={{
                  background: 'transparent',
                  border: 'none',
                  boxSizing: 'border-box',
                  display: 'block',
                  ...COMMENT_INPUT_TEXT_STYLE,
                  maxWidth: '100%',
                  minWidth: 0,
                  minHeight: 40,
                  outline: 'none',
                  overflowX: 'hidden',
                  overflowWrap: 'anywhere',
                  padding: showSendButton ? '5px 12px 28px' : '5px 12px 8px',
                  position: 'relative',
                  whiteSpace: 'pre-wrap',
                  width: '100%',
                  wordBreak: 'break-word',
                }}
              />
            </Slate>
          </Box>

          {showSendButton && (
            <Flex align="center" gap={1} style={{bottom: 6, position: 'absolute', right: 8}}>
              <Button
                fontSize={1}
                mode="bleed"
                onClick={handleAtButton}
                padding={2}
                text="@"
                title="Mention someone"
              />
              <Box
                style={{
                  background: 'var(--card-border-color)',
                  height: 16,
                  width: 1,
                }}
              />
              <Button
                disabled={!hasContent}
                fontSize={1}
                icon={<Send size={16} />}
                mode="bleed"
                onClick={handleSend}
                padding={2}
                title="Send (⌘+Enter)"
              />
            </Flex>
          )}
        </Card>

        {!!mentionState && cursorRect && (
          <MentionsMenu
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

interface MentionsMenuProps {
  cursorRect: DOMRect
  onClose: () => void
  onSelect: (userId: string) => void
  searchTerm: string
}

function MentionsMenu({cursorRect, onClose, onSelect, searchTerm}: MentionsMenuProps) {
  const {data: users = []} = useUsers()
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users

    const term = deburr(searchTerm).toLocaleLowerCase()
    return users
      .filter((user) => {
        const name = deburr(user.profile?.displayName ?? '').toLocaleLowerCase()
        return name.includes(term)
      })
      .sort((a, b) => {
        const aName = deburr(a.profile?.displayName ?? '').toLocaleLowerCase()
        const bName = deburr(b.profile?.displayName ?? '').toLocaleLowerCase()
        const aStarts = aName.startsWith(term)
        const bStarts = bName.startsWith(term)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return 0
      })
  }, [searchTerm, users])

  useEffect(() => {
    setActiveIndex(0)
  }, [filteredUsers.length])

  const popoverStyle = useMemo(() => {
    const menuWidth = 224
    const viewportPadding = 8
    const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
    const left = Math.min(Math.max(cursorRect.left, viewportPadding), maxLeft)

    return {
      left,
      position: 'fixed' as const,
      top: Math.min(cursorRect.bottom + 4, window.innerHeight - 200),
      zIndex: 2000,
    }
  }, [cursorRect])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (filteredUsers[activeIndex]) {
          const userId =
            getResourceUserId(filteredUsers[activeIndex]) ?? filteredUsers[activeIndex].sanityUserId
          onSelect(userId)
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [activeIndex, filteredUsers, onClose, onSelect])

  if (filteredUsers.length === 0) {
    return createPortal(
      <Card padding={2} radius={2} shadow={2} style={{...popoverStyle, width: 224}}>
        <Text muted size={1}>
          No users found
        </Text>
      </Card>,
      document.body,
    )
  }

  return createPortal(
    <Card
      padding={1}
      radius={2}
      shadow={3}
      role="listbox"
      style={{
        ...popoverStyle,
        maxHeight: 192,
        overflowY: 'auto',
        width: 224,
      }}
    >
      <Stack space={1}>
        {filteredUsers.map((user, index) => {
          const userId = getResourceUserId(user) ?? user.sanityUserId
          const displayName = user.profile?.displayName ?? 'Unknown'
          const isActive = index === activeIndex

          return (
            <Button
              fontSize={1}
              justify="flex-start"
              key={userId}
              mode={isActive ? 'default' : 'bleed'}
              onClick={() => onSelect(userId)}
              onMouseEnter={() => setActiveIndex(index)}
              padding={2}
              style={{transition: 'none'}}
              text={
                <Flex align="center" gap={2}>
                  {renderAvatar(user, displayName)}
                  <Text size={1} style={{maxWidth: 150}} textOverflow="ellipsis">
                    {displayName}
                  </Text>
                </Flex>
              }
              tone={isActive ? 'primary' : 'default'}
            />
          )
        })}
      </Stack>
    </Card>,
    document.body,
  )
}

function renderAvatar(user: SanityUser | undefined, displayName: string) {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: user?.profile?.imageUrl
          ? 'transparent'
          : 'var(--card-badge-default-bg-color, #e3e4e8)',
        color: 'var(--card-badge-default-fg-color, #515e72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '7px',
        fontWeight: 600,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {user?.profile?.imageUrl ? (
        <img
          alt={displayName}
          src={user.profile.imageUrl}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      ) : (
        getInitials(displayName)
      )}
    </div>
  )
}
