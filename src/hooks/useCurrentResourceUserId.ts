import {useCurrentUser, useUsers} from '@sanity/sdk-react'
import {useMemo} from 'react'

import {getCurrentResourceUserId} from '../helpers/users/addonUserUtils'

export function useCurrentResourceUserId(): string | undefined {
  const currentUser = useCurrentUser()
  const {data: users = []} = useUsers()

  return useMemo(() => getCurrentResourceUserId(currentUser?.id, users), [currentUser?.id, users])
}
