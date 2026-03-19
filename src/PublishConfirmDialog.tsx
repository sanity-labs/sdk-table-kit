import React, {Suspense} from 'react'
import {Button, Card, Dialog, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useDocumentPermissions} from '@sanity/sdk-react'
import {publishDocument} from '@sanity/sdk'

/**
 * Props for the PublishConfirmDialog component.
 */
export interface PublishConfirmDialogProps {
  documents: Array<{_id: string; _type: string; title?: string}>
  onConfirm: () => void | Promise<void>
  onClose: () => void
  isPublishing?: boolean
}

/**
 * A single document row that checks publish permissions via the SDK.
 * Wrapped in Suspense by the parent since useDocumentPermissions may suspend.
 */
function DocumentRow({doc}: {doc: {_id: string; _type: string; title?: string}}) {
  const action = publishDocument({documentId: doc._id, documentType: doc._type})
  const {allowed, message} = useDocumentPermissions(action)

  return (
    <Card padding={3} tone={allowed ? 'default' : 'caution'} data-testid={`doc-row-${doc._id}`}>
      <Flex align="center" gap={2}>
        <Text size={1} muted={!allowed}>
          {doc.title ?? doc._id}
        </Text>
        {!allowed && (
          <Text size={0} muted data-testid={`permission-denied-${doc._id}`}>
            {message ?? 'Cannot publish'}
          </Text>
        )}
      </Flex>
    </Card>
  )
}

/**
 * Confirmation dialog for bulk publishing documents.
 * Shows a scrollable list of documents with permission checks,
 * and provides Cancel / Publish actions.
 */
export function PublishConfirmDialog({
  documents,
  onConfirm,
  onClose,
  isPublishing = false,
}: PublishConfirmDialogProps) {
  const count = documents.length
  const title = `Publish ${count} document${count !== 1 ? 's' : ''}`

  return (
    <Dialog
      id="publish-confirm"
      header={title}
      onClose={onClose}
      footer={
        <Flex gap={2} justify="flex-end" padding={3}>
          <Button text="Cancel" mode="ghost" onClick={onClose} disabled={isPublishing} />
          <Button
            text={title}
            tone="positive"
            onClick={onConfirm}
            disabled={isPublishing}
            data-testid="publish-button"
          />
        </Flex>
      }
    >
      <Stack space={2} padding={3} style={{maxHeight: 300, overflowY: 'auto'}}>
        {isPublishing && (
          <Flex justify="center" padding={3} data-testid="publish-spinner">
            <Spinner />
          </Flex>
        )}
        {documents.map((doc) => (
          <Suspense
            key={doc._id}
            fallback={
              <Card padding={3}>
                <Text size={1} muted>
                  Loading…
                </Text>
              </Card>
            }
          >
            <DocumentRow doc={doc} />
          </Suspense>
        ))}
      </Stack>
    </Dialog>
  )
}
