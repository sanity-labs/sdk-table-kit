import type {BaseEditor, Descendant} from 'slate'
import {Element as SlateElement} from 'slate'
import type {ReactEditor} from 'slate-react'

export type CommentEditorInstance = BaseEditor & ReactEditor
export type CommentEditorText = {text: string}

export interface CommentMentionElement {
  children: [CommentEditorText]
  type: 'mention'
  userId: string
}

export interface CommentParagraphElement {
  children: Array<CommentEditorText | CommentMentionElement>
  type: 'paragraph'
}

export function isCommentMentionElement(value: unknown): value is CommentMentionElement {
  return (
    SlateElement.isElement(value) &&
    'type' in value &&
    value.type === 'mention' &&
    'userId' in value
  )
}

export function isCommentParagraphElement(value: unknown): value is CommentParagraphElement {
  return SlateElement.isElement(value) && 'type' in value && value.type === 'paragraph'
}

export type CommentEditorValue = Descendant[]
