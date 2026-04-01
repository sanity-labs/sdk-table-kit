import {useQuery} from '@sanity/sdk-react'
import {useCallback, useEffect, useMemo, useState} from 'react'

import {COMMENTS_BY_DOC_QUERY} from './addonCommentUtils'
import {useAddonData} from './AddonDataContext'
import type {AddonMessage, CommentDocument, CommentReaction, CommentStatus} from './addonTypes'

interface OptimisticEdit {
  lastEditedAt: string
  message: AddonMessage
}

export function useAddonComments(documentId: string) {
  const {addonDataset, projectId} = useAddonData()
  const cleanId = documentId.replace('drafts.', '')

  const {data: serverComments, isPending} = useQuery<CommentDocument[]>({
    dataset: addonDataset,
    params: {documentId: cleanId},
    projectId,
    query: COMMENTS_BY_DOC_QUERY,
  })

  const [optimisticAdds, setOptimisticAdds] = useState<CommentDocument[]>([])
  const [optimisticDeletes, setOptimisticDeletes] = useState<Set<string>>(new Set())
  const [optimisticEdits, setOptimisticEdits] = useState<Map<string, OptimisticEdit>>(new Map())
  const [optimisticReactions, setOptimisticReactions] = useState<Map<string, CommentReaction[]>>(
    new Map(),
  )
  const [optimisticStatusUpdates, setOptimisticStatusUpdates] = useState<
    Map<string, CommentStatus>
  >(new Map())

  const comments = useMemo(() => {
    const server = serverComments ?? []
    const serverIds = new Set(server.map((comment) => comment._id))

    const merged = server
      .filter((comment) => !optimisticDeletes.has(comment._id))
      .map((comment) => {
        let nextComment = comment

        const statusOverride = optimisticStatusUpdates.get(comment._id)
        if (statusOverride !== undefined) {
          nextComment = {...nextComment, status: statusOverride}
        }

        const editOverride = optimisticEdits.get(comment._id)
        if (editOverride) {
          nextComment = {
            ...nextComment,
            lastEditedAt: editOverride.lastEditedAt,
            message: editOverride.message,
          }
        }

        const reactionOverride = optimisticReactions.get(comment._id)
        if (reactionOverride !== undefined) {
          nextComment = {...nextComment, reactions: reactionOverride}
        }

        return nextComment
      })

    const pending = optimisticAdds.filter(
      (comment) => !serverIds.has(comment._id) && !optimisticDeletes.has(comment._id),
    )

    return [...merged, ...pending]
  }, [
    optimisticAdds,
    optimisticDeletes,
    optimisticEdits,
    optimisticReactions,
    optimisticStatusUpdates,
    serverComments,
  ])

  useEffect(() => {
    if (!serverComments) return

    const serverIds = new Set(serverComments.map((comment) => comment._id))

    setOptimisticAdds((prev) => {
      const next = prev.filter((comment) => !serverIds.has(comment._id))
      return next.length === prev.length ? prev : next
    })

    setOptimisticStatusUpdates((prev) => {
      let changed = false
      const next = new Map(prev)

      for (const [id, status] of prev) {
        const server = serverComments.find((comment) => comment._id === id)
        if (server && server.status === status) {
          next.delete(id)
          changed = true
        }
      }

      return changed ? next : prev
    })

    setOptimisticEdits((prev) => {
      let changed = false
      const next = new Map(prev)

      for (const [id, edit] of prev) {
        const server = serverComments.find((comment) => comment._id === id)
        if (server && server.lastEditedAt === edit.lastEditedAt) {
          next.delete(id)
          changed = true
        }
      }

      return changed ? next : prev
    })

    setOptimisticDeletes((prev) => {
      let changed = false
      const next = new Set(prev)

      for (const id of prev) {
        if (!serverIds.has(id)) {
          next.delete(id)
          changed = true
        }
      }

      return changed ? next : prev
    })

    setOptimisticReactions((prev) => {
      let changed = false
      const next = new Map(prev)

      for (const [id, reactions] of prev) {
        const server = serverComments.find((comment) => comment._id === id)
        if (!server) continue

        const serverReactions = server.reactions ?? []
        if (serverReactions.length === reactions.length) {
          next.delete(id)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [serverComments])

  const addOptimisticComment = useCallback((comment: CommentDocument) => {
    setOptimisticAdds((prev) => [...prev, comment])

    return () => {
      setOptimisticAdds((prev) => prev.filter((entry) => entry._id !== comment._id))
    }
  }, [])

  const deleteOptimisticComment = useCallback((commentId: string) => {
    setOptimisticDeletes((prev) => {
      const next = new Set(prev)
      next.add(commentId)
      return next
    })

    return () => {
      setOptimisticDeletes((prev) => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }, [])

  const editOptimisticComment = useCallback(
    (commentId: string, message: AddonMessage, lastEditedAt: string) => {
      const prevEdit = optimisticEdits.get(commentId)
      const serverComment = (serverComments ?? []).find((comment) => comment._id === commentId)

      setOptimisticEdits((prev) => {
        const next = new Map(prev)
        next.set(commentId, {lastEditedAt, message})
        return next
      })

      return () => {
        setOptimisticEdits((prev) => {
          const next = new Map(prev)
          if (prevEdit) {
            next.set(commentId, prevEdit)
          } else if (serverComment) {
            next.delete(commentId)
          } else {
            next.delete(commentId)
          }
          return next
        })
      }
    },
    [optimisticEdits, serverComments],
  )

  const updateOptimisticReactions = useCallback(
    (commentId: string, reactions: CommentReaction[]) => {
      const prevReactions = optimisticReactions.get(commentId)

      setOptimisticReactions((prev) => {
        const next = new Map(prev)
        next.set(commentId, reactions)
        return next
      })

      return () => {
        setOptimisticReactions((prev) => {
          const next = new Map(prev)
          if (prevReactions !== undefined) {
            next.set(commentId, prevReactions)
          } else {
            next.delete(commentId)
          }
          return next
        })
      }
    },
    [optimisticReactions],
  )

  const updateOptimisticStatus = useCallback(
    (commentId: string, newStatus: CommentStatus) => {
      const prevStatus = optimisticStatusUpdates.get(commentId)
      const serverComment = (serverComments ?? []).find((comment) => comment._id === commentId)
      const rollbackStatus = prevStatus ?? serverComment?.status

      setOptimisticStatusUpdates((prev) => {
        const next = new Map(prev)
        next.set(commentId, newStatus)
        return next
      })

      return () => {
        setOptimisticStatusUpdates((prev) => {
          const next = new Map(prev)
          if (rollbackStatus !== undefined) {
            next.set(commentId, rollbackStatus)
          } else {
            next.delete(commentId)
          }
          return next
        })
      }
    },
    [optimisticStatusUpdates, serverComments],
  )

  return {
    addOptimisticComment,
    comments,
    deleteOptimisticComment,
    editOptimisticComment,
    isPending,
    updateOptimisticReactions,
    updateOptimisticStatus,
  }
}
