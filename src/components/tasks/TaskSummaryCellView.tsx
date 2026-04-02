import {useOptionalAddonData} from '../../context/AddonDataContext'
import {TaskSummaryCellInner, type TaskSummaryCellProps} from './TaskSummaryCellInner'

export function TaskSummaryCellView({documentId, documentType}: TaskSummaryCellProps) {
  const addonData = useOptionalAddonData()

  if (!addonData) {
    return <span style={{color: 'var(--card-muted-fg-color)'}}>—</span>
  }

  return <TaskSummaryCellInner documentId={documentId} documentType={documentType} />
}
