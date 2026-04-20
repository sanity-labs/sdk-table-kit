import {useOptionalAddonData} from '../../context/AddonDataContext'
import {TaskSummaryCellInner, type TaskSummaryCellProps} from './TaskSummaryCellInner'

export interface TaskSummaryCellViewProps extends TaskSummaryCellProps {
  readOnly?: boolean
}

export function TaskSummaryCellView({
  documentId,
  documentType,
  readOnly = false,
}: TaskSummaryCellViewProps) {
  const addonData = useOptionalAddonData()

  if (!addonData) {
    return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
  }

  return <TaskSummaryCellInner documentId={documentId} documentType={documentType} readOnly={readOnly} />
}
