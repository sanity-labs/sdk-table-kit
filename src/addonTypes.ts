export interface CrossDatasetReference {
  _dataset: string
  _projectId: string
  _ref: string
  _type: 'crossDatasetReference'
  _weak: boolean
}

export interface AddonTarget {
  document: CrossDatasetReference
  documentType: string
}

export type AddonMessage = Array<{
  _key: string
  _type: 'block'
  children: Array<
    | {_key: string; _type: 'mention'; userId: string}
    | {_key?: string; _type: 'span'; marks?: string[]; text: string}
  >
  markDefs?: Array<{_key: string; _type: string; [key: string]: unknown}>
  style?: string
}> | null

export interface CommentReaction {
  _key: string
  addedAt: string
  shortName: string
  userId: string
}

export type CommentStatus = 'open' | 'resolved'

export interface CommentDocument {
  _createdAt: string
  _id: string
  _rev?: string
  _type: 'comment'
  _updatedAt: string
  authorId: string
  context?: {
    notification?: {
      currentThreadLength?: number
      documentTitle?: string
      url?: string
      workspaceName?: string
      workspaceTitle?: string
    }
    payload?: Record<string, unknown>
    tool?: string
  }
  contentSnapshot?: unknown
  lastEditedAt?: string
  message: AddonMessage
  parentCommentId?: string
  reactions?: CommentReaction[] | null
  status: CommentStatus
  subscribers?: string[]
  target: {
    document: CrossDatasetReference
    documentType: string
    path?: {field: string}
  }
  threadId: string
}

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
  title?: string
}

export interface AddonDataContextValue {
  addonDataset: string
  contentDataset?: string
  isLoading: boolean
  patchTasks: (docRef: string, updater: (tasks: TaskDocument[]) => TaskDocument[]) => void
  projectId: string
  tasksByDocId: Map<string, TaskDocument[]>
  workspaceId?: string
  workspaceTitle?: string
}
