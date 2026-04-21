import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import type {ReactNode} from 'react'

export function NuqsHookWrapper({children}: {children: ReactNode}) {
  return <NuqsTestingAdapter hasMemory>{children}</NuqsTestingAdapter>
}
