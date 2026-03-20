import {ChevronDownIcon} from '@sanity/icons'
import {Button, Flex, Menu, MenuButton, MenuDivider, MenuItem, Text} from '@sanity/ui'
import React from 'react'

import {useReleaseContext} from './ReleaseContext'

const DOT_COLORS: Record<string, string> = {
  asap: '#f59e0b',
  scheduled: '#8b5cf6',
  undecided: '#6b7280',
}

const GROUP_LABELS: Array<{type: string; label: string}> = [
  {type: 'asap', label: 'ASAP'},
  {type: 'scheduled', label: 'Scheduled'},
  {type: 'undecided', label: 'Undecided'},
]

interface ReleasePickerProps {
  onCreateRelease?: () => void
}

export function ReleasePicker({onCreateRelease}: ReleasePickerProps) {
  const {activeReleases, selectedRelease, selectedReleaseId, setSelectedReleaseId} =
    useReleaseContext()

  // Group releases by type
  const grouped: Record<string, typeof activeReleases> = {
    asap: activeReleases.filter((r) => r.metadata.releaseType === 'asap'),
    scheduled: activeReleases.filter((r) => r.metadata.releaseType === 'scheduled'),
    undecided: activeReleases.filter((r) => r.metadata.releaseType === 'undecided'),
  }

  const buttonText = selectedRelease ? selectedRelease.metadata.title : 'Drafts'

  return (
    <MenuButton
      id="release-picker"
      button={
        <Button
          mode="bleed"
          text={buttonText}
          iconRight={ChevronDownIcon}
          data-testid="release-picker-button"
        />
      }
      menu={
        <Menu data-testid="release-picker-menu">
          <MenuItem
            text="Published"
            onClick={() => setSelectedReleaseId(null)}
            data-testid="option-published"
          />
          <MenuItem
            text="Drafts"
            onClick={() => setSelectedReleaseId(null)}
            data-testid="option-drafts"
            selected={!selectedReleaseId}
          />
          <MenuDivider />

          {GROUP_LABELS.map(({type, label}) => {
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
                    onClick={() => setSelectedReleaseId(r.name)}
                    selected={selectedReleaseId === r.name}
                    data-testid={`release-${r.name}`}
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
                        data-testid={`dot-${r.name}`}
                      />
                      <Text size={1}>{r.metadata.title}</Text>
                    </Flex>
                  </MenuItem>
                ))}
              </React.Fragment>
            )
          })}

          <MenuDivider />
          <MenuItem
            text="Create new release"
            onClick={onCreateRelease}
            data-testid="create-release-button"
          />
        </Menu>
      }
    />
  )
}
