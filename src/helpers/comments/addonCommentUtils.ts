import {
  buildCommentDocument as buildPublicCommentDocument,
  buildCommentNotificationContext,
  buildCommentTarget,
  buildCommentThreads,
  buildMessageFromPlainText,
  buildStudioCommentUrl,
  buildTaskCommentDocument,
  buildTaskStudioUrl as buildPublicTaskStudioUrl,
  getCommentThreadsForField,
  groupUnresolvedCommentsByField,
  toPlainText,
  type CommentDocument,
  type CommentMessage,
  type CommentThread,
  type CommentThreadGroup,
} from '@sanetti/sanity-table-kit'

const DEFAULT_STUDIO_BASE_URL = 'https://www.sanity.io/@oNAgKWFqi/studio/beihhm8eq5gszxxix51uhpzo'

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

export const TASK_COMMENTS_QUERY = `*[
  _type == "comment"
  && target.documentType == "tasks.task"
  && target.document._ref == $taskId
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
  subscribers,
  context,
  target
} | order(_createdAt asc)`

interface BuildCommentDocumentOptions {
  authorId: string
  commentId?: string
  createdAt?: string
  currentThreadLength?: number
  documentId: string
  documentTitle?: string
  documentType: string
  field?: string
  message: CommentMessage
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
  return buildStudioCommentUrl({
    commentId,
    documentId,
    documentType,
    studioBaseUrl: DEFAULT_STUDIO_BASE_URL,

    workspaceName,
  })
}

export function buildTaskStudioUrl(
  taskId: string,
  workspaceName: string = 'admin',
  commentId?: string,
) {
  return buildPublicTaskStudioUrl({commentId, taskId, workspaceName})
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

  return buildPublicCommentDocument({
    authorId,
    commentId: id,
    context: buildCommentNotificationContext({
      currentThreadLength: currentThreadLength ?? (parentCommentId ? 2 : 1),
      documentTitle: documentTitle ?? '',
      payload: {workspace: workspaceId ?? ''},
      url: buildStudioUrl(documentId, documentType, id, workspaceId),
      workspaceName: workspaceId ?? '',
      workspaceTitle: workspaceTitle ?? '',
    }),
    createdAt: now,
    message,
    parentCommentId,
    status,
    target: buildCommentTarget({
      contentDataset,
      documentId,
      documentType,
      fieldPath: field,
      projectId,
    }),
    threadId,
  }) as CommentDocument & {
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
  }
}

export {
  buildCommentThreads,
  buildMessageFromPlainText,
  buildTaskCommentDocument,
  getCommentThreadsForField,
  groupUnresolvedCommentsByField,
  toPlainText,
}
export type {CommentThread, CommentThreadGroup}
