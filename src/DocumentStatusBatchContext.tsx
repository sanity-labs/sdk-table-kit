import React, {createContext, useContext} from 'react'

export interface ActiveReleaseSnapshot {
  name: string
  metadata: {
    title?: string
    releaseType?: 'asap' | 'scheduled' | 'undecided'
  }
}

export interface DocumentStatusSnapshot {
  versionIds: ReadonlyArray<string>
}

export type DocumentStatusMap = ReadonlyMap<string, DocumentStatusSnapshot>

export interface DocumentStatusBatchContextValue {
  activeReleases: ReadonlyArray<ActiveReleaseSnapshot>
  loading: boolean
  statusByBaseId: DocumentStatusMap
}

const DocumentStatusBatchContext = createContext<DocumentStatusBatchContextValue | null>(null)

export function DocumentStatusBatchProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: DocumentStatusBatchContextValue
}) {
  return (
    <DocumentStatusBatchContext.Provider value={value}>
      {children}
    </DocumentStatusBatchContext.Provider>
  )
}

export function useOptionalDocumentStatusBatchContext() {
  return useContext(DocumentStatusBatchContext)
}
