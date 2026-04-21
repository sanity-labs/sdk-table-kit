import type {EditedFieldIndicatorTone} from '../../helpers/releases/perspectiveTones'

export interface CommentableCellProps {
  cellPadding: {x: number; y: number}
  children: React.ReactNode
  commentFieldLabel?: string
  commentFieldPath: string
  documentId: string
  documentTitle?: string
  documentType: string
  editedIndicatorTone?: EditedFieldIndicatorTone
}
