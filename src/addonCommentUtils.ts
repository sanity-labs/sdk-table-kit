import type {AddonMessage, CommentDocument} from './addonTypes'

export const COMMENTS_BY_DOC_QUERY = `*[
  _type == "comment"
  && target.document._ref == $documentId
]{
  _id,
  _type,
  _createdAt,
  _updatedAt,
  authorId,
  message,
  status,
  threadId,
  parentCommentId,
  lastEditedAt,
  reactions,
  target
} | order(_createdAt asc)`

const STUDIO_BASE = 'https://www.sanity.io/@oNAgKWFqi/studio/beihhm8eq5gszxxix51uhpzo'

export interface CommentThread {
  parent: CommentDocument
  replies: CommentDocument[]
}

export interface CommentThreadGroup {
  field: string
  threads: CommentThread[]
}

interface GetCommentThreadsForFieldOptions {
  field: string
  includeResolved?: boolean
}

interface BuildCommentDocumentOptions {
  authorId: string
  commentId?: string
  createdAt?: string
  currentThreadLength?: number
  documentId: string
  documentTitle?: string
  documentType: string
  field?: string
  message: AddonMessage
  parentCommentId?: string
  projectId: string
  status?: 'open' | 'resolved'
  threadId?: string
  workspaceId?: string
  workspaceTitle?: string
  contentDataset: string
}

export function buildStudioUrl(
  documentId: string,
  documentType: string,
  commentId: string,
  workspaceName: string = 'news_and_media',
): string {
  const cleanId = documentId.replace('drafts.', '')
  return `${STUDIO_BASE}/${workspaceName}/intent/edit/id=${cleanId};type=${documentType};inspect=sanity%2Fcomments;comment=${commentId}/`
}

export function buildCommentDocument({
  authorId,
  commentId,
  createdAt,
  currentThreadLength,
  documentId,
  documentTitle,
  documentType,
  field,
  message,
  parentCommentId,
  projectId,
  status,
  threadId,
  workspaceId,
  workspaceTitle,
  contentDataset,
}: BuildCommentDocumentOptions): CommentDocument & {
  context?: {
    notification: {
      currentThreadLength: number
      documentTitle: string
      url: string
      workspaceName: string
      workspaceTitle: string
    }
    payload: {workspace: string}
    tool: string
  }
  subscribers: string[]
} {
  const id = commentId ?? crypto.randomUUID()
  const now = createdAt ?? new Date().toISOString()

  return {
    _createdAt: now,
    _id: id,
    _type: 'comment',
    _updatedAt: now,
    authorId,
    context: {
      notification: {
        currentThreadLength: currentThreadLength ?? (parentCommentId ? 2 : 1),
        documentTitle: documentTitle ?? '',
        url: buildStudioUrl(documentId, documentType, id, workspaceId),
        workspaceName: workspaceId ?? '',
        workspaceTitle: workspaceTitle ?? '',
      },
      payload: {workspace: workspaceId ?? ''},
      tool: '',
    },
    message,
    reactions: [],
    status: status ?? 'open',
    subscribers: [authorId],
    target: {
      document: {
        _dataset: contentDataset,
        _projectId: projectId,
        _ref: documentId.replace('drafts.', ''),
        _type: 'crossDatasetReference',
        _weak: true,
      },
      documentType,
      path: {field: field ?? 'title'},
    },
    threadId: threadId ?? id,
    ...(parentCommentId ? {parentCommentId} : {}),
  }
}

export function buildMessageFromPlainText(text: string): AddonMessage {
  return [
    {
      _key: crypto.randomUUID().slice(0, 8),
      _type: 'block',
      children: [
        {
          _key: crypto.randomUUID().slice(0, 8),
          _type: 'span',
          text,
        },
      ],
      style: 'normal',
    },
  ]
}

export function buildCommentThreads(comments: CommentDocument[]): CommentThread[] {
  const threadMap = new Map<string, CommentThread>()

  for (const comment of comments) {
    if (!comment.parentCommentId) {
      threadMap.set(comment.threadId || comment._id, {parent: comment, replies: []})
    }
  }

  for (const comment of comments) {
    if (!comment.parentCommentId) continue

    const thread = threadMap.get(comment.threadId)
    if (thread) {
      thread.replies.push(comment)
    }
  }

  return Array.from(threadMap.values())
}

export function getCommentThreadField(thread: CommentThread): string {
  return thread.parent.target.path?.field || 'unknownField'
}

export function getCommentThreadsForField(
  comments: CommentDocument[],
  {field, includeResolved = false}: GetCommentThreadsForFieldOptions,
): CommentThread[] {
  return buildCommentThreads(comments)
    .filter((thread) => {
      if (getCommentThreadField(thread) !== field) return false
      if (!includeResolved && thread.parent.status === 'resolved') return false
      return true
    })
    .sort(
      (a, b) => new Date(b.parent._createdAt).getTime() - new Date(a.parent._createdAt).getTime(),
    )
}

export function groupUnresolvedCommentsByField(comments: CommentDocument[]): CommentThreadGroup[] {
  const grouped = new Map<string, CommentThread[]>()

  for (const thread of buildCommentThreads(comments)) {
    if (thread.parent.status === 'resolved') continue

    const field = getCommentThreadField(thread)
    const existing = grouped.get(field)
    if (existing) {
      existing.push(thread)
    } else {
      grouped.set(field, [thread])
    }
  }

  return [...grouped.entries()]
    .sort(([fieldA], [fieldB]) => fieldA.localeCompare(fieldB))
    .map(([field, threads]) => ({
      field,
      threads: threads.sort(
        (a, b) => new Date(b.parent._createdAt).getTime() - new Date(a.parent._createdAt).getTime(),
      ),
    }))
}

export function toPlainText(message: AddonMessage): string {
  if (!message) return ''

  return message
    .flatMap((block) =>
      block.children.map((child) => {
        if (child._type === 'mention') return `@${child.userId}`
        return child.text ?? ''
      }),
    )
    .join('')
    .trim()
}
