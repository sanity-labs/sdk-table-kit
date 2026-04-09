import {useTaskComments as useSdkCommentsTaskComments} from '@sanity-labs/sdk-comments'

export function useTaskComments(taskId: string): ReturnType<typeof useSdkCommentsTaskComments> {
  return useSdkCommentsTaskComments({
    taskId,
  })
}
