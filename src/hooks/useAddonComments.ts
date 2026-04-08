import {useDocumentComments as useSdkCommentsDocumentComments} from '@sanity-labs/sdk-comments'

export function useAddonComments(documentId: string) {
  return useSdkCommentsDocumentComments({
    documentId,
  })
}
