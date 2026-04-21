import {AddIcon} from '@sanity/icons'
import {Button, Flex, Menu, MenuButton, MenuDivider, MenuItem, Text} from '@sanity/ui'
import React, {useCallback, useState} from 'react'

import {useReleaseContext} from '../../context/ReleaseContext'
import {useSafeToast} from '../../hooks/useSafeToast'

const DOT_COLORS: Record<string, string> = {
  asap: '#f59e0b',
  scheduled: '#8b5cf6',
  undecided: '#6b7280',
}

const GROUP_ORDER: Array<{type: string; label: string}> = [
  {type: 'asap', label: 'ASAP'},
  {type: 'scheduled', label: 'Scheduled'},
  {type: 'undecided', label: 'Undecided'},
]

interface AddToReleaseButtonProps {
  /** Document IDs to add to the selected release */
  selectedIds: string[]
  /** Called after successful add (e.g., to clear selection) */
  onComplete?: () => void
  /** Called when user clicks "Create new release" */
  onCreateRelease?: () => void
}

export function AddToReleaseButton({
  selectedIds,
  onComplete,
  onCreateRelease,
}: AddToReleaseButtonProps) {
  const {activeReleases, addToRelease} = useReleaseContext()
  const toast = useSafeToast()
  const [isAdding, setIsAdding] = useState(false)

  // Group releases by type
  const grouped: Record<string, typeof activeReleases> = {
    asap: activeReleases.filter((r) => r.metadata.releaseType === 'asap'),
    scheduled: activeReleases.filter((r) => r.metadata.releaseType === 'scheduled'),
    undecided: activeReleases.filter((r) => r.metadata.releaseType === 'undecided'),
  }

  const handleSelect = useCallback(
    async (releaseName: string, releaseTitle: string) => {
      setIsAdding(true)
      try {
        await addToRelease(selectedIds, releaseName)
        toast.push({
          status: 'success',
          title: `Added ${selectedIds.length} document${selectedIds.length === 1 ? '' : 's'} to "${releaseTitle}"`,
        })
        onComplete?.()
      } catch (err) {
        toast.push({
          status: 'error',
          title: 'Failed to add documents to release',
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        setIsAdding(false)
      }
    },
    [addToRelease, selectedIds, toast, onComplete],
  )

  return (
    <MenuButton
      id="add-to-release"
      button={
        <Button
          mode="ghost"
          text="Add to Release"
          icon={AddIcon}
          disabled={isAdding}
          aria-label="Add to Release"
        />
      }
      menu={
        <Menu>
          {GROUP_ORDER.map(({type, label}) => {
            const releases = grouped[type]
            if (!releases || releases.length === 0) return null
            return (
              <React.Fragment key={type}>
                <MenuItem disabled>
                  <Text size={0} muted weight="semibold">
                    {label}
                  </Text>
                </MenuItem>
                {releases.map((r) => (
                  <MenuItem
                    key={r.name}
                    onClick={() => handleSelect(r.name, r.metadata.title ?? r.name)}
                  >
                    <Flex align="center" gap={2}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: DOT_COLORS[type],
                          flexShrink: 0,
                        }}
                      />
                      <Text size={1}>{r.metadata.title ?? r.name}</Text>
                    </Flex>
                  </MenuItem>
                ))}
              </React.Fragment>
            )
          })}
          <MenuDivider />
          <MenuItem text="Create release" onClick={onCreateRelease} />
        </Menu>
      }
    />
  )
}
