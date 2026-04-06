import {useTaskComments as useSdkCommentsTaskComments} from '@sanetti/sdk-comments'

export function useTaskComments(taskId: string) {
  return useSdkCommentsTaskComments({
    taskId,
  })
}
