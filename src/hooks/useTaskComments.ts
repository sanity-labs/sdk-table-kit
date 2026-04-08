import {useTaskComments as useSdkCommentsTaskComments} from '@sanity-labs/sdk-comments'

export function useTaskComments(taskId: string) {
  return useSdkCommentsTaskComments({
    taskId,
  })
}
