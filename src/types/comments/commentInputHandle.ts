import type {AddonMessage} from '../addonTypes'

export interface CommentInputHandle {
  clear: () => void
  focus: () => void
  getValue: () => AddonMessage
  isEmpty: () => boolean
}
