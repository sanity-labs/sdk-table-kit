import type {
  CommentDocument as PublicCommentDocument,
  CommentMessage as PublicCommentMessage,
  CommentReaction as PublicCommentReaction,
  CommentStatus as PublicCommentStatus,
  CommentTarget as PublicCommentTarget,
  CrossDatasetReference as PublicCrossDatasetReference,
  Reference as PublicReference,
} from '@sanity-labs/react-table-kit'
import type {SanityUser} from '@sanity/sdk-react'

export type CrossDatasetReference = PublicCrossDatasetReference

export type Reference = PublicReference

export type AddonTarget = PublicCommentTarget

export type AddonMessage = PublicCommentMessage

export type CommentReaction = PublicCommentReaction

export type CommentStatus = PublicCommentStatus

export type CommentDocument = PublicCommentDocument

export interface TaskContext {
  notification?: {
    targetContentImageUrl: null | string
    targetContentTitle: null | string
    url: string
    workspaceTitle: string
  }
  payload?: Record<string, unknown>
  tool?: string
}

export type TaskStatus = 'closed' | 'open'

export interface TaskDocument {
  _createdAt: string
  _id: string
  _rev?: string
  _type: 'tasks.task'
  _updatedAt: string
  assignedTo?: string
  authorId: string
  context?: TaskContext
  createdByUser?: string
  description?: AddonMessage
  dueBy?: string
  lastEditedAt?: string
  status: TaskStatus
  subscribers?: string[]
  target?: AddonTarget
  title: string
}

export interface TaskEditPayload {
  assignedTo?: string
  description?: AddonMessage
  dueBy?: string
  lastEditedAt?: string
  status?: TaskStatus
  subscribers?: string[]
  title?: string
}

export interface AddonDataContextValue {
  addonDataset: string
  contentDataset?: string
  isLoading: boolean
  patchTasks: (docRef: string, updater: (tasks: TaskDocument[]) => TaskDocument[]) => void
  projectId: string
  tasksByDocId: Map<string, TaskDocument[]>
  users?: SanityUser[]
  workspaceId?: string
  workspaceTitle?: string
}
