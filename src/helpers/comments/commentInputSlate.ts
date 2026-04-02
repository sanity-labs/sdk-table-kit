import {Editor, type Descendant, Text as SlateText} from 'slate'

import type {AddonMessage} from '../../types/addonTypes'
import type {
  CommentEditorInstance,
  CommentEditorText,
  CommentEditorValue,
  CommentMentionElement,
  CommentParagraphElement,
} from '../../types/comments/commentInputTypes'
import {
  isCommentMentionElement,
  isCommentParagraphElement,
} from '../../types/comments/commentInputTypes'

export function generatePortableTextKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function createEmptyEditorValue(): Descendant[] {
  return [
    {
      children: [{text: ''}],
      type: 'paragraph',
    } as unknown as Descendant,
  ]
}

export function createMentionNode(userId: string): CommentMentionElement {
  return {
    children: [{text: ''}],
    type: 'mention',
    userId,
  }
}

export function addonMessageToSlateValue(value: AddonMessage): CommentEditorValue {
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

export function slateValueToAddonMessage(value: Descendant[]): AddonMessage {
  const blocks: NonNullable<AddonMessage> = []

  for (const node of value) {
    if (!isCommentParagraphElement(node)) continue

    const children: NonNullable<AddonMessage>[0]['children'] = []
    for (const child of node.children) {
      if (isCommentMentionElement(child)) {
        children.push({
          _key: generatePortableTextKey(),
          _type: 'mention',
          userId: child.userId,
        })
      } else if (SlateText.isText(child) && child.text) {
        children.push({_key: generatePortableTextKey(), _type: 'span', text: child.text})
      }
    }

    blocks.push({
      _key: generatePortableTextKey(),
      _type: 'block',
      children:
        children.length > 0
          ? children
          : [{_key: generatePortableTextKey(), _type: 'span', text: ''}],
      markDefs: [],
      style: 'normal',
    })
  }

  const hasContent = blocks.some((block) =>
    block.children.some((child) => child._type === 'mention' || !!child.text.trim()),
  )

  return hasContent ? blocks : null
}

export function withMentions(editor: CommentEditorInstance): CommentEditorInstance {
  const {isInline, isVoid} = editor

  editor.isInline = (element) => {
    return isCommentMentionElement(element) ? true : isInline(element)
  }

  editor.isVoid = (element) => {
    return isCommentMentionElement(element) ? true : isVoid(element)
  }

  return editor
}

export function replaceEditorValue(editor: CommentEditorInstance, value: Descendant[]) {
  editor.children = value
  const end = Editor.end(editor, [])
  editor.selection = {anchor: end, focus: end}
  editor.onChange()
}

export function editorHasContent(value: Descendant[]): boolean {
  return value.some((node) => {
    if (!isCommentParagraphElement(node)) return false

    return node.children.some((child) => {
      if (isCommentMentionElement(child)) return true
      return SlateText.isText(child) && !!child.text.trim()
    })
  })
}
