import type {SanityUser} from '@sanity/sdk-react'
import {useCurrentUser} from '@sanity/sdk-react'
import {useUsers} from '@sanity/sdk-react'
import {createContext, useContext, type ReactNode} from 'react'

import {getCurrentResourceUserId} from '../helpers/users/addonUserUtils'

interface TaskUsersContextValue {
  currentResourceUserId?: string
  users: SanityUser[]
}

const TaskUsersContext = createContext<TaskUsersContextValue | null>(null)

export function TaskUsersValueProvider({
  children,
  currentResourceUserId,
  users,
}: {
  children: ReactNode
  currentResourceUserId?: string
  users: SanityUser[]
}) {
  return (
    <TaskUsersContext.Provider value={{currentResourceUserId, users}}>
      {children}
    </TaskUsersContext.Provider>
  )
}

export function TaskUsersProvider({children}: {children: ReactNode}) {
  const currentUser = useCurrentUser()
  const {data: users = []} = useUsers()
  const currentResourceUserId = getCurrentResourceUserId(currentUser?.id, users)

  return (
    <TaskUsersValueProvider currentResourceUserId={currentResourceUserId} users={users}>
      {children}
    </TaskUsersValueProvider>
  )
}

export function useTaskUsers() {
  return useContext(TaskUsersContext)?.users ?? []
}

export function useTaskCurrentResourceUserId() {
  return useContext(TaskUsersContext)?.currentResourceUserId
}

export function useOptionalTaskUsers() {
  return useContext(TaskUsersContext)?.users ?? null
}
