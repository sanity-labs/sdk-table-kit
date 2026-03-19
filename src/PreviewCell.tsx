import React from 'react'
import {useDocumentPreview} from '@sanity/sdk-react'

/**
 * Props for the PreviewCell component.
 */
export interface PreviewCellProps {
  documentId: string
  documentType: string
}

/**
 * Cell component that renders a document preview using the SDK's useDocumentPreview hook.
 * Shows title, optional subtitle, and optional media thumbnail.
 */
export function PreviewCell({documentId, documentType}: PreviewCellProps) {
  const {data: preview} = useDocumentPreview({documentId, documentType})

  const title = preview?.title ?? documentId
  const subtitle = preview?.subtitle
  const media = preview?.media
  const imageUrl =
    typeof media === 'string'
      ? media
      : media && typeof media === 'object' && 'url' in media
        ? String(media.url)
        : null

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          role="img"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '4px',
            objectFit: 'cover',
          }}
        />
      )}
      <div>
        <div style={{fontWeight: 500}}>{title}</div>
        {subtitle && (
          <div style={{fontSize: '12px', color: 'var(--card-muted-fg-color, #666)'}}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
