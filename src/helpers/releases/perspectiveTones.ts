import type {FilterSurfaceTone} from '@sanity-labs/react-table-kit'

type PerspectiveKind = 'drafts' | 'published' | 'release'
type ReleaseType = 'asap' | 'scheduled' | 'undecided' | undefined

export type EditedFieldIndicatorTone = 'default' | 'positive' | 'caution' | 'suggest'

export function getPerspectiveSurfaceTone(
  perspectiveKind: PerspectiveKind,
  releaseType: ReleaseType,
): FilterSurfaceTone {
  if (perspectiveKind === 'published') {
    return 'positive'
  }

  switch (releaseType) {
    case 'asap':
      return 'caution'
    case 'scheduled':
      return 'suggest'
    case 'undecided':
      return 'transparent'
    default:
      return 'default'
  }
}

export function getEditedFieldIndicatorTone(
  perspectiveKind: PerspectiveKind,
  releaseType: ReleaseType,
): EditedFieldIndicatorTone {
  if (perspectiveKind === 'published') {
    return 'positive'
  }

  switch (releaseType) {
    case 'asap':
      return 'caution'
    case 'scheduled':
      return 'suggest'
    case 'undecided':
      return 'default'
    default:
      return 'default'
  }
}
