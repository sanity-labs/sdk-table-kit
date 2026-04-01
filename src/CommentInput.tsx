import {useUsers} from '@sanity/sdk-react'
import {Avatar} from '@sanity/ui'
import {deburr} from 'lodash-es'
import {SendIcon} from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

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

function generateKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function createMentionElement(userId: string, displayName: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.setAttribute('data-mention-user-id', userId)
  span.setAttribute('contenteditable', 'false')
  span.style.display = 'inline-flex'
  span.style.alignItems = 'center'
  span.style.borderRadius = '4px'
  span.style.padding = '0 2px'
  span.style.fontWeight = '600'
  span.style.color = '#2563eb'
  span.textContent = `@${displayName}`
  return span
}

function deserializeFromPortableText(
  container: HTMLElement,
  value: AddonMessage,
  resolveMentionName: (userId: string) => string,
) {
  container.innerHTML = ''
  if (!value || value.length === 0) return

  for (const block of value) {
    for (const child of block.children) {
      if (child._type === 'mention') {
        container.appendChild(createMentionElement(child.userId, resolveMentionName(child.userId)))
      } else if (child._type === 'span' && child.text) {
        container.appendChild(document.createTextNode(child.text))
      }
    }
  }
}

function serializeToPortableText(container: HTMLElement): AddonMessage {
  const children: NonNullable<AddonMessage>[0]['children'] = []

  const walkNodes = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ''
        if (text) {
          children.push({_key: generateKey(), _type: 'span', text})
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        const mentionUserId = element.getAttribute('data-mention-user-id')
        if (mentionUserId) {
          children.push({_key: generateKey(), _type: 'mention', userId: mentionUserId})
        } else if (element.tagName !== 'BR') {
          walkNodes(element)
        }
      }
    }
  }

  walkNodes(container)

  const hasContent = children.some((child) => {
    if (child._type === 'mention') return true
    return !!child.text.trim()
  })

  if (!hasContent) return null

  return [
    {
      _key: generateKey(),
      _type: 'block',
      children:
        children.length > 0 ? children : [{_key: generateKey(), _type: 'span' as const, text: ''}],
      markDefs: [],
      style: 'normal',
    },
  ]
}

function findMentionTrigger(text: string, cursorOffset: number): number {
  const beforeCursor = text.slice(0, cursorOffset)
  for (let index = beforeCursor.length - 1; index >= 0; index -= 1) {
    if (beforeCursor[index] !== '@') continue

    const charBefore = index > 0 ? beforeCursor[index - 1] : undefined
    if (!charBefore || charBefore === ' ' || charBefore === '\u00A0') {
      return index
    }

    return -1
  }

  return -1
}

export const CommentInput = forwardRef<CommentInputHandle, CommentInputProps>(function CommentInput(
  {autoFocus, initialValue, onCancel, onSubmit, placeholder = 'Add a comment...', showSendButton},
  ref,
) {
  const {data: users = []} = useUsers()
  const rootRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLDivElement>(null)
  const [hasContent, setHasContent] = useState(false)
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [mentionsSearchTerm, setMentionsSearchTerm] = useState('')
  const [cursorRect, setCursorRect] = useState<DOMRect | null>(null)

  const resolveMentionName = useCallback(
    (userId: string) => {
      return findUserByResourceUserId(userId, users)?.profile?.displayName ?? userId
    },
    [users],
  )

  useEffect(() => {
    if (editableRef.current && initialValue) {
      deserializeFromPortableText(editableRef.current, initialValue, resolveMentionName)
      setHasContent(true)
    }
  }, [initialValue, resolveMentionName])

  useEffect(() => {
    if (!autoFocus || !editableRef.current) return

    const element = editableRef.current
    element.focus()
    const selection = window.getSelection()
    if (selection && element.childNodes.length > 0) {
      selection.selectAllChildren(element)
      selection.collapseToEnd()
    }
  }, [autoFocus])

  const updateHasContent = useCallback(() => {
    if (!editableRef.current) return

    const text = editableRef.current.textContent?.trim() ?? ''
    const hasMentions = editableRef.current.querySelector('[data-mention-user-id]') !== null
    setHasContent(text.length > 0 || hasMentions)
  }, [])

  const getValue = useCallback((): AddonMessage => {
    if (!editableRef.current) return null
    return serializeToPortableText(editableRef.current)
  }, [])

  const isEmpty = useCallback(() => !getValue(), [getValue])

  const clearEditor = useCallback(() => {
    if (!editableRef.current) return
    editableRef.current.innerHTML = ''
    setHasContent(false)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      clear: clearEditor,
      focus: () => editableRef.current?.focus(),
      getValue,
      isEmpty,
    }),
    [clearEditor, getValue, isEmpty],
  )

  const closeMentions = useCallback(() => {
    setMentionsOpen(false)
    setMentionsSearchTerm('')
  }, [])

  const insertMention = useCallback(
    (userId: string) => {
      const editable = editableRef.current
      if (!editable) {
        closeMentions()
        return
      }

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        closeMentions()
        return
      }

      const range = selection.getRangeAt(0)
      const textNode = range.startContainer
      if (textNode.nodeType !== Node.TEXT_NODE) {
        closeMentions()
        return
      }

      const text = textNode.textContent ?? ''
      const cursorOffset = range.startOffset
      const atIndex = findMentionTrigger(text, cursorOffset)

      if (atIndex < 0) {
        closeMentions()
        return
      }

      const displayName = resolveMentionName(userId)
      const mentionElement = createMentionElement(userId, displayName)
      const beforeText = text.slice(0, atIndex)
      const afterText = text.slice(cursorOffset)
      const parent = textNode.parentNode
      if (!parent) {
        closeMentions()
        return
      }

      const fragment = document.createDocumentFragment()
      if (beforeText) fragment.appendChild(document.createTextNode(beforeText))
      fragment.appendChild(mentionElement)

      const trailingText = `\u00A0${afterText}`
      const trailingNode = document.createTextNode(trailingText)
      fragment.appendChild(trailingNode)

      parent.replaceChild(fragment, textNode)

      const newRange = document.createRange()
      newRange.setStart(trailingNode, 1)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)

      closeMentions()
      updateHasContent()
      editable.focus()
    },
    [closeMentions, resolveMentionName, updateHasContent],
  )

  const handleInput = useCallback(() => {
    updateHasContent()

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      if (mentionsOpen) closeMentions()
      return
    }

    const range = selection.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE) {
      if (mentionsOpen) closeMentions()
      return
    }

    const text = textNode.textContent ?? ''
    const cursorOffset = range.startOffset
    const atIndex = findMentionTrigger(text, cursorOffset)

    if (atIndex < 0) {
      if (mentionsOpen) closeMentions()
      return
    }

    const searchTerm = text.slice(atIndex + 1, cursorOffset)
    if (searchTerm.includes(' ') || searchTerm.includes('\u00A0')) {
      if (mentionsOpen) closeMentions()
      return
    }

    if (!mentionsOpen) setMentionsOpen(true)
    setMentionsSearchTerm(searchTerm)
  }, [closeMentions, mentionsOpen, updateHasContent])

  useEffect(() => {
    const handler = () => {
      const selection = window.getSelection()
      if (!selection?.isCollapsed || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      if (rootRef.current?.contains(range.commonAncestorContainer)) {
        setCursorRect(range.getBoundingClientRect())
      }
    }

    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (mentionsOpen) {
        if (event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          closeMentions()
          return
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') {
          return
        }
      }

      if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        return
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (!isEmpty() && onSubmit) {
          onSubmit(getValue())
        }
        return
      }

      if (event.key === 'Escape' && onCancel) {
        onCancel()
      }
    },
    [closeMentions, getValue, isEmpty, mentionsOpen, onCancel, onSubmit],
  )

  const handleSend = useCallback(() => {
    if (!isEmpty() && onSubmit) {
      onSubmit(getValue())
    }
  }, [getValue, isEmpty, onSubmit])

  const handleAtButton = useCallback(() => {
    const editable = editableRef.current
    if (!editable) return

    editable.focus()
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const textNode = document.createTextNode('@')
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    setMentionsOpen(true)
    setMentionsSearchTerm('')
    updateHasContent()
  }, [updateHasContent])

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ')
    document.execCommand('insertText', false, text)
  }, [])

  const showPlaceholder = !hasContent

  return (
    <div ref={rootRef} style={{position: 'relative'}}>
      {showPlaceholder && (
        <div
          aria-hidden
          style={{
            color: 'var(--card-muted-fg-color)',
            inset: 0,
            padding: '8px 12px 0',
            pointerEvents: 'none',
            position: 'absolute',
            fontSize: 13,
          }}
        >
          {placeholder}
        </div>
      )}

      <div
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        ref={editableRef}
        role="textbox"
        suppressContentEditableWarning
        style={{
          minHeight: 36,
          width: '100%',
          borderRadius: 8,
          border: '1px solid var(--card-border-color)',
          background: 'transparent',
          padding: showSendButton ? '8px 12px 32px' : '8px 12px',
          fontSize: 13,
          lineHeight: 1.45,
          boxSizing: 'border-box',
        }}
      />

      {showSendButton && (
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 2,
            position: 'absolute',
            right: 8,
            bottom: 6,
          }}
        >
          <button
            onClick={handleAtButton}
            tabIndex={-1}
            title="Mention someone"
            type="button"
            style={{
              alignItems: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--card-muted-fg-color)',
              cursor: 'pointer',
              display: 'flex',
              height: 24,
              justifyContent: 'center',
              width: 24,
            }}
          >
            <span style={{fontSize: 14, fontWeight: 600}}>@</span>
          </button>
          <span style={{background: 'var(--card-border-color)', width: 1, height: 16}} />
          <button
            disabled={!hasContent}
            onClick={handleSend}
            tabIndex={-1}
            title="Send (Cmd/Ctrl+Enter)"
            type="button"
            style={{
              alignItems: 'center',
              background: 'transparent',
              border: 'none',
              color: hasContent ? 'var(--card-muted-fg-color)' : 'var(--card-muted-fg-color)',
              cursor: hasContent ? 'pointer' : 'default',
              display: 'flex',
              height: 24,
              justifyContent: 'center',
              opacity: hasContent ? 1 : 0.4,
              width: 24,
            }}
          >
            <SendIcon size={14} />
          </button>
        </div>
      )}

      {mentionsOpen && cursorRect && (
        <MentionsMenu
          cursorRect={cursorRect}
          onClose={closeMentions}
          onSelect={insertMention}
          rootRef={rootRef}
          searchTerm={mentionsSearchTerm}
        />
      )}
    </div>
  )
})

interface MentionsMenuProps {
  cursorRect: DOMRect
  onClose: () => void
  onSelect: (userId: string) => void
  rootRef: React.RefObject<HTMLDivElement | null>
  searchTerm: string
}

function MentionsMenu({cursorRect, onClose, onSelect, rootRef, searchTerm}: MentionsMenuProps) {
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
      .sort((userA, userB) => {
        const nameA = deburr(userA.profile?.displayName ?? '').toLocaleLowerCase()
        const nameB = deburr(userB.profile?.displayName ?? '').toLocaleLowerCase()
        const startsA = nameA.startsWith(term)
        const startsB = nameB.startsWith(term)
        if (startsA && !startsB) return -1
        if (!startsA && startsB) return 1
        return 0
      })
  }, [searchTerm, users])

  useEffect(() => {
    setActiveIndex(0)
  }, [filteredUsers.length])

  const popoverStyle = useMemo(() => {
    const rootRect = rootRef.current?.getBoundingClientRect()
    if (!rootRect) return {}

    return {
      left: cursorRect.left - rootRect.left,
      position: 'absolute' as const,
      top: cursorRect.bottom - rootRect.top + 4,
      zIndex: 50,
    }
  }, [cursorRect, rootRef])

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
        const user = filteredUsers[activeIndex]
        if (!user) return
        onSelect(getResourceUserId(user) ?? user.sanityUserId)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [activeIndex, filteredUsers, onClose, onSelect])

  if (filteredUsers.length === 0) {
    return (
      <div
        style={{
          ...popoverStyle,
          width: 224,
          borderRadius: 8,
          border: '1px solid var(--card-border-color)',
          background: 'var(--card-bg-color)',
          padding: 8,
          fontSize: 12,
          color: 'var(--card-muted-fg-color)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        No users found
      </div>
    )
  }

  return (
    <div
      role="listbox"
      style={{
        ...popoverStyle,
        width: 224,
        maxHeight: 192,
        overflowY: 'auto',
        borderRadius: 8,
        border: '1px solid var(--card-border-color)',
        background: 'var(--card-bg-color)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      {filteredUsers.map((user, index) => {
        const userId = getResourceUserId(user) ?? user.sanityUserId
        const displayName = user.profile?.displayName ?? 'Unknown'
        return (
          <button
            aria-selected={index === activeIndex}
            key={userId}
            onClick={() => onSelect(userId)}
            onMouseEnter={() => setActiveIndex(index)}
            role="option"
            type="button"
            style={{
              alignItems: 'center',
              width: '100%',
              display: 'flex',
              gap: 8,
              padding: '6px 8px',
              border: 'none',
              background:
                index === activeIndex
                  ? 'var(--card-code-bg-color, var(--card-bg2-color))'
                  : 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <Avatar alt={displayName} size={1} src={user.profile?.imageUrl ?? ''} />
            <span
              style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </span>
          </button>
        )
      })}
    </div>
  )
}
