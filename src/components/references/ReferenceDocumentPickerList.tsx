import type {DocumentHandle} from '@sanity/sdk'
import {useDocuments} from '@sanity/sdk-react'
import type {PreviewConfig, PreviewValue} from '@sanity/types'
import {Spinner} from '@sanity/ui'
import {Suspense, useDeferredValue, useRef} from 'react'

import {buildProjectionString} from '../../helpers/references/referenceProjection'
import {ReferencePickerOptionRow} from './ReferencePickerOptionRow'
import {InitialSkeleton, OptionSkeleton} from './ReferencePickerSkeletons'

interface ReferenceDocumentPickerListProps {
  onDocumentsLoaded: (docs: DocumentHandle[]) => void
  onSelect: (docId: string, prepared?: PreviewValue) => void
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  referenceType: string
  searchQuery: string
  value: {_type: 'reference'; _ref: string} | null
}

interface CachedReferenceDocumentPickerListProps {
  documents: DocumentHandle[]
  onSelect: (docId: string, prepared?: PreviewValue) => void
  preview: Required<Pick<PreviewConfig, 'select' | 'prepare'>>
  value: {_type: 'reference'; _ref: string} | null
}

export function ReferenceDocumentPickerList({
  onDocumentsLoaded,
  onSelect,
  preview,
  referenceType,
  searchQuery,
  value,
}: ReferenceDocumentPickerListProps) {
  const deferredQuery = useDeferredValue(searchQuery)
  const isStale = deferredQuery !== searchQuery

  const {data: documents, isPending} = useDocuments({
    documentType: referenceType,
    ...(deferredQuery ? {search: deferredQuery} : {}),
  })

  const lastReportedRef = useRef<string>('')
  const docIds = documents?.map((d) => d.documentId).join(',') ?? ''
  if (documents && documents.length > 0 && docIds !== lastReportedRef.current) {
    lastReportedRef.current = docIds
    onDocumentsLoaded(documents)
  }

  const projectionString = buildProjectionString(preview.select)

  if (!documents || documents.length === 0) {
    if (isPending || isStale) {
      return (
        <div style={{padding: '12px', display: 'flex', justifyContent: 'center'}}>
          <Spinner muted />
        </div>
      )
    }
    return (
      <div style={{padding: '12px', textAlign: 'center', color: 'var(--card-muted-fg-color)'}}>
        No results
      </div>
    )
  }

  return (
    <div style={{opacity: isPending || isStale ? 0.5 : 1, transition: 'opacity 150ms ease'}}>
      {documents.map((handle) => (
        <Suspense fallback={<OptionSkeleton />} key={handle.documentId}>
          <ReferencePickerOptionRow
            handle={handle}
            isSelected={value?._ref === handle.documentId}
            onClick={onSelect}
            preview={preview}
            projectionString={projectionString}
          />
        </Suspense>
      ))}
    </div>
  )
}

export function CachedReferenceDocumentPickerList({
  documents,
  onSelect,
  preview,
  value,
}: CachedReferenceDocumentPickerListProps) {
  const projectionString = buildProjectionString(preview.select)

  return (
    <div style={{opacity: 0.5, transition: 'opacity 150ms ease', position: 'relative'}}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Spinner muted />
      </div>
      {documents.map((handle) => (
        <Suspense fallback={<OptionSkeleton />} key={handle.documentId}>
          <ReferencePickerOptionRow
            handle={handle}
            isSelected={value?._ref === handle.documentId}
            onClick={onSelect}
            preview={preview}
            projectionString={projectionString}
          />
        </Suspense>
      ))}
    </div>
  )
}

export {InitialSkeleton}
