import {useClient} from '@sanity/sdk-react'
import {useCallback, useMemo} from 'react'

import {buildCommentDocument} from './addonCommentUtils'
import {useAddonData} from './AddonDataContext'
import type {AddonMessage, CommentReaction, CommentStatus} from './addonTypes'
import {useCurrentResourceUserId} from './useCurrentResourceUserId'

export function useAddonCommentMutations() {
  const {addonDataset, contentDataset, projectId, workspaceId, workspaceTitle} = useAddonData()
  const currentResourceUserId = useCurrentResourceUserId()
  const baseClient = useClient({apiVersion: '2025-05-06'})

  const client = useMemo(
    () =>
      baseClient.withConfig({
        dataset: addonDataset,
        projectId,
      }),
    [addonDataset, baseClient, projectId],
  )

  const createComment = useCallback(
    async (
      documentId: string,
      documentType: string,
      documentTitle: string,
      message: AddonMessage,
      parentCommentId?: string,
      threadId?: string,
      commentId?: string,
      field?: string,
    ) => {
      if (!contentDataset) {
        throw new Error('Addon content dataset is not configured')
      }

      const authorId = currentResourceUserId ?? 'unknown'

      const comment = buildCommentDocument({
        authorId,
        commentId,
        contentDataset,
        documentId,
        documentTitle,
        documentType,
        field,
        message,
        parentCommentId,
        projectId,
        threadId,
        workspaceId,
        workspaceTitle,
      })

      try {
        return await client.create(comment)
      } catch (error) {
        console.error('[useAddonCommentMutations] createComment failed:', error)
        throw error
      }
    },
    [client, contentDataset, currentResourceUserId, projectId, workspaceId, workspaceTitle],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      try {
        return await client.delete(commentId)
      } catch (error) {
        console.error(`[useAddonCommentMutations] deleteComment failed (${commentId}):`, error)
        throw error
      }
    },
    [client],
  )

  const editComment = useCallback(
    async (commentId: string, message: AddonMessage) => {
      try {
        return await client
          .patch(commentId)
          .set({lastEditedAt: new Date().toISOString(), message})
          .commit()
      } catch (error) {
        console.error(`[useAddonCommentMutations] editComment failed (${commentId}):`, error)
        throw error
      }
    },
    [client],
  )

  const setCommentStatus = useCallback(
    async (commentId: string, status: CommentStatus) => {
      try {
        return await client.patch(commentId).set({status}).commit()
      } catch (error) {
        console.error(`[useAddonCommentMutations] setCommentStatus failed (${commentId}):`, error)
        throw error
      }
    },
    [client],
  )

  const toggleReaction = useCallback(
    async (commentId: string, shortName: string, currentReactions: CommentReaction[]) => {
      const userId = currentResourceUserId ?? 'unknown'
      const existing = currentReactions.find(
        (reaction) => reaction.shortName === shortName && reaction.userId === userId,
      )

      try {
        if (existing) {
          return await client
            .patch(commentId)
            .unset([`reactions[_key=="${existing._key}"]`])
            .commit()
        }

        const reaction: CommentReaction = {
          _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
          addedAt: new Date().toISOString(),
          shortName,
          userId,
        }

        return await client
          .patch(commentId)
          .setIfMissing({reactions: []})
          .append('reactions', [reaction])
          .commit()
      } catch (error) {
        console.error(`[useAddonCommentMutations] toggleReaction failed (${commentId}):`, error)
        throw error
      }
    },
    [client, currentResourceUserId],
  )

  return {createComment, deleteComment, editComment, setCommentStatus, toggleReaction}
}
