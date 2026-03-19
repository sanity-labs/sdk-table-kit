import {useCallback, useState} from 'react'
import {Button, Dialog, Flex, Stack, Text, TextArea, TextInput, useToast} from '@sanity/ui'
import {useReleaseContext} from './ReleaseContext'
import type {CreateReleaseMetadata} from './ReleaseContext'

interface CreateReleaseDialogProps {
  onClose: () => void
}

export function CreateReleaseDialog({onClose}: CreateReleaseDialogProps) {
  const {createRelease} = useReleaseContext()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [releaseType, setReleaseType] = useState<'asap' | 'scheduled' | 'undecided'>('undecided')
  const [intendedPublishAt, setIntendedPublishAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      const metadata: CreateReleaseMetadata = {
        title,
        releaseType,
        ...(description && {description}),
        ...(releaseType === 'scheduled' && intendedPublishAt && {intendedPublishAt}),
      }
      await createRelease(metadata)
      onClose()
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Failed to create release',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [title, description, releaseType, intendedPublishAt, createRelease, onClose, toast])

  return (
    <Dialog header="Create release" id="create-release-dialog" onClose={onClose} width={1}>
      <Stack padding={4} space={4}>
        {/* Title input */}
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Title
          </Text>
          <TextInput
            placeholder="Release title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            data-testid="release-title-input"
          />
        </Stack>

        {/* Description */}
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Description
          </Text>
          <TextArea
            placeholder="Optional description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            data-testid="release-description-input"
            rows={3}
          />
        </Stack>

        {/* Release type selection */}
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Release type
          </Text>
          <Flex gap={2}>
            {(['asap', 'scheduled', 'undecided'] as const).map((type) => (
              <Button
                key={type}
                text={type.charAt(0).toUpperCase() + type.slice(1)}
                mode={releaseType === type ? 'default' : 'ghost'}
                tone={releaseType === type ? 'primary' : 'default'}
                onClick={() => setReleaseType(type)}
                data-testid={`release-type-${type}`}
              />
            ))}
          </Flex>
        </Stack>

        {/* Date picker for scheduled */}
        {releaseType === 'scheduled' && (
          <Stack space={2}>
            <Text size={1} weight="semibold">
              Publish date
            </Text>
            <TextInput
              type="date"
              value={intendedPublishAt}
              onChange={(e) => setIntendedPublishAt(e.currentTarget.value)}
              data-testid="release-date-input"
            />
          </Stack>
        )}

        {/* Actions */}
        <Flex gap={2} justify="flex-end">
          <Button text="Cancel" mode="ghost" onClick={onClose} />
          <Button
            text="Create release"
            tone="primary"
            disabled={!title.trim() || isSubmitting}
            onClick={handleSubmit}
            data-testid="create-release-submit"
          />
        </Flex>
      </Stack>
    </Dialog>
  )
}
