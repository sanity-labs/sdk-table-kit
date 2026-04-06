import {useDocumentComments as useSdkCommentsDocumentComments} from '@sanetti/sdk-comments'

export function useAddonComments(documentId: string) {
  return useSdkCommentsDocumentComments({
    documentId,
  })
}
