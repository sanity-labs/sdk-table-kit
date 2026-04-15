import type {SanityUser} from '@sanity/sdk-react'

import type {TaskDocument} from '../../types/addonTypes'
import {TaskSummaryEditorView} from './TaskSummaryEditorView'

/** @deprecated Prefer `TaskSummaryEditorView` — kept for backwards compatibility. */
export function TaskSummaryDetailView({
  onDeleteOptimistic,
  onDeleteRollback,
  onInternalInteraction,
  onBack,
  onRegisterFlushPending,
  task,
  users,
}: {
  onDeleteOptimistic?: (taskId: string) => void
  onDeleteRollback?: (taskId: string) => void
  onInternalInteraction?: (durationMs?: number) => void
  onBack: () => void
  onRegisterFlushPending?: (flushFn: null | (() => Promise<boolean>)) => void
  task: TaskDocument
  users: SanityUser[]
}) {
  return (
    <TaskSummaryEditorView
      documentId=""
      documentType=""
      onBack={onBack}
      onDeleteOptimistic={onDeleteOptimistic}
      onDeleteRollback={onDeleteRollback}
      onInternalInteraction={onInternalInteraction}
      onRegisterFlushPending={onRegisterFlushPending}
      onTaskMaterialized={() => {}}
      task={task}
      users={users}
    />
  )
}
