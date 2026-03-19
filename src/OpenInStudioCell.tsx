import React, {Suspense} from 'react'
import {useClient} from '@sanity/sdk-react'
import {useNavigateToStudioDocument} from '@sanity/sdk-react'
import {LaunchIcon} from '@sanity/icons'
import {Button} from '@sanity/ui'

interface OpenInStudioCellProps {
  documentId: string
  documentType: string
}

function NavigateButton({documentId, documentType}: OpenInStudioCellProps) {
  const client = useClient({apiVersion: '2025-05-06'})
  const {projectId, dataset} = client.config()
  const {navigateToStudioDocument} = useNavigateToStudioDocument({
    documentId,
    documentType,
    projectId: projectId ?? '',
    dataset: dataset ?? '',
  })
  return (
    <Button
      icon={LaunchIcon}
      mode="bleed"
      style={{border: '1px solid #e0e0e0'}}
      onClick={navigateToStudioDocument}
      padding={2}
      title="Open in Studio"
    />
  )
}

export function OpenInStudioCell({documentId, documentType}: OpenInStudioCellProps) {
  return (
    <Suspense fallback={<Button icon={LaunchIcon} mode="bleed" padding={2} disabled />}>
      <NavigateButton documentId={documentId} documentType={documentType} />
    </Suspense>
  )
}
