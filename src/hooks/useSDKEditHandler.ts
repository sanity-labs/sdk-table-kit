import type {DocumentBase} from '@sanity-labs/react-table-kit'
import {editDocument} from '@sanity/sdk'
import {useApplyDocumentActions} from '@sanity/sdk-react'
import {useCallback} from 'react'

import {useOptionalReleaseContext} from '../context/ReleaseContext'
import {useReleaseDocumentMutations} from './useReleaseDocumentMutations'

/**
 * Result from the SDK edit handler hook.
 */
export interface SDKEditHandlerResult {
  /** Edit a document field via the SDK. */
  handleEdit: (document: DocumentBase, field: string, value: unknown) => Promise<void>
  /** Create a bound onSave callback for a specific field. */
  createOnSave: (field: string) => (document: DocumentBase, newValue: string) => void
}

/**
 * Hook that provides SDK-backed inline editing via `useEditDocument`.
 * Returns handlers that can be wired to column edit configs.
 *
 * @example
 * ```tsx
 * const { createOnSave } = useSDKEditHandler()
 *
 * const cols = [
 *   column.custom({
 *     field: 'title',
 *     header: 'Title',
 *     edit: {
 *       mode: 'text',
 *       onSave: createOnSave('title'),
 *     },
 *   }),
 * ]
 * ```
 */
export function useSDKEditHandler(): SDKEditHandlerResult {
  const apply = useApplyDocumentActions()
  const releaseContext = useOptionalReleaseContext()
  const {hasSelectedRelease, patchDocumentInRelease} = useReleaseDocumentMutations()
  const isPublishedPerspective = releaseContext?.isPublishedPerspective ?? false

  const handleEdit = useCallback(
    async (document: DocumentBase, field: string, value: unknown) => {
      if (isPublishedPerspective) {
        throw new Error('Cannot edit while the published perspective is selected')
      }

      if (hasSelectedRelease) {
        await patchDocumentInRelease(document._id, {set: {[field]: value}})
        return
      }

      await apply(
        editDocument(
          {
            documentId: document._id,
            documentType: document._type,
          },
          {set: {[field]: value}},
        ),
      )
    },
    [apply, hasSelectedRelease, isPublishedPerspective, patchDocumentInRelease],
  )

  const createOnSave = useCallback(
    (field: string) => {
      return (document: DocumentBase, newValue: string) => {
        void handleEdit(document, field, newValue).catch((error) => {
          console.error('[useSDKEditHandler] Failed to save field:', error)
        })
      }
    },
    [handleEdit],
  )

  return {handleEdit, createOnSave}
}
