import type {Membership, SanityUser} from '@sanity/sdk-react'

export function findUserByResourceUserId(
  resourceUserId: string,
  users: SanityUser[],
): SanityUser | undefined {
  if (!resourceUserId) return undefined

  return users.find((user) => {
    const memberships = user.memberships as ({resourceUserId: string} & Membership)[]
    return memberships?.some((membership) => membership.resourceUserId === resourceUserId)
  })
}

export function getResourceUserId(user: SanityUser): string | undefined {
  const memberships = user.memberships as ({resourceUserId: string} & Membership)[]
  return memberships?.[0]?.resourceUserId
}

export function getCurrentResourceUserId(
  sanityUserId: string | undefined,
  users: SanityUser[],
): string | undefined {
  if (!sanityUserId || users.length === 0) return undefined

  const currentProjectUser = users.find((user) => user.sanityUserId === sanityUserId)
  return currentProjectUser ? getResourceUserId(currentProjectUser) : undefined
}

export function getUserDisplayNameByResourceUserId(
  resourceUserId: string | undefined,
  users: SanityUser[],
): null | string {
  if (!resourceUserId) return null

  return findUserByResourceUserId(resourceUserId, users)?.profile?.displayName ?? resourceUserId
}
