import type {ColumnDef, DocumentBase} from '@sanity-labs/react-table-kit'
import {isEqual} from 'lodash-es'

import {CommentableCell} from '../../components/comments/CommentableCell'
import {CellDecoratorFrame} from '../../components/table/CellDecoratorFrame'
import type {EditedFieldIndicatorTone} from '../../helpers/releases/perspectiveTones'
import {normalizeBaseDocumentId} from '../../helpers/releases/documentIds'
import type {CellCommentsConfig} from '../../hooks/useColumnProjection'

interface DecoratorAwareColumn<T extends DocumentBase = DocumentBase> extends ColumnDef<T> {
  comments?: CellCommentsConfig
}

export function withEditedFieldIndicators<T extends DocumentBase = DocumentBase>(
  columns: ColumnDef<T>[],
  options: {
    editedIndicatorTone?: EditedFieldIndicatorTone
    publishedRowsByBaseId: Map<string, T>
  },
): ColumnDef<T>[] {
  const {editedIndicatorTone, publishedRowsByBaseId} = options

  if (!editedIndicatorTone) {
    return columns
  }

  return columns.map((column) => {
    const existingDecorator = column.cellDecorator
    const commentAwareColumn = column as DecoratorAwareColumn<T>
    const comments = commentAwareColumn.comments
    const isComparable = !!column.field && !column._isSelectColumn

    if (!comments && !isComparable) {
      return column
    }

    return {
      ...column,
      cellDecorator: ({cellPadding, content, row, value}) => {
        const publishedComparisonRow = isComparable
          ? publishedRowsByBaseId.get(normalizeBaseDocumentId(row._id))
          : undefined
        const publishedValue =
          publishedComparisonRow && column.field
            ? (publishedComparisonRow as Record<string, unknown>)[column.field]
            : undefined
        const isEdited = !!publishedComparisonRow && isComparable && !isEqual(value, publishedValue)

        if (comments) {
          return (
            <CommentableCell
              cellPadding={cellPadding}
              commentFieldLabel={comments.fieldLabel}
              commentFieldPath={comments.fieldPath}
              documentId={row._id}
              documentTitle={typeof row.title === 'string' ? row.title : undefined}
              documentType={row._type}
              editedIndicatorTone={isEdited ? editedIndicatorTone : undefined}
            >
              {content}
            </CommentableCell>
          )
        }

        const decoratedContent = existingDecorator
          ? existingDecorator({cellPadding, content, row, value})
          : content

        if (!isEdited) {
          return decoratedContent
        }

        return (
          <CellDecoratorFrame cellPadding={cellPadding} indicatorTone={editedIndicatorTone}>
            {decoratedContent}
          </CellDecoratorFrame>
        )
      },
    }
  })
}
