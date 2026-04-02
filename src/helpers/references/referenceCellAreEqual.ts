import type {ReferenceCellProps} from '../../types/references/referenceCellTypes'

export function referenceCellAreEqual(prev: ReferenceCellProps, next: ReferenceCellProps): boolean {
  if (prev.value !== next.value) return false
  if (prev.row._id !== next.row._id) return false
  if (prev.row._updatedAt !== next.row._updatedAt) return false
  if (!!prev.editMeta !== !!next.editMeta) return false
  if (prev.editMeta && next.editMeta) {
    if (prev.editMeta.referenceType !== next.editMeta.referenceType) return false
    if (prev.editMeta.rawRefValue?._ref !== next.editMeta.rawRefValue?._ref) return false
    if (prev.editMeta.placeholder !== next.editMeta.placeholder) return false
  }
  return true
}
