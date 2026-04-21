import {ChevronDownIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Label, Menu, MenuButton, MenuItem, Stack, Text} from '@sanity/ui'
import {useMemo} from 'react'
import styled from 'styled-components'

import {useReleaseContext, type ReleaseDocument} from '../../context/ReleaseContext'
import {
  GlobalPerspectiveMenuItemIndicator,
  GlobalPerspectiveMenuLabelIndicator,
} from './PerspectiveLayerIndicator'
import {ReleaseAvatarIcon, type PerspectiveLayer} from './ReleaseAvatarIcon'
import {oversizedButtonStyle} from './styles'

type ReleaseType = 'asap' | 'scheduled' | 'undecided'
const MENU_INSET = '0.25rem'

const ORDERED_RELEASE_TYPES: ReleaseType[] = ['asap', 'scheduled', 'undecided']

const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  asap: 'AS SOON AS POSSIBLE',
  scheduled: 'AT TIME',
  undecided: 'UNDECIDED',
}

const PillShell = styled(Card)`
  max-width: 100%;
  align-items: center;
  padding: 0.1875rem;
  min-height: 2.0625rem;

  a,
  button {
    position: relative;
    &:hover,
    &:focus-visible {
      z-index: 1;
    }
  }
`

/** Trigger button with the oversized hit area from Studio. */
const TriggerButton = styled(Button)`
  ${oversizedButtonStyle}
`

const StyledMenu = styled(Menu)`
  --menu-inset: ${MENU_INSET};

  & [data-ui='Stack'] {
    gap: 0;
  }
  min-width: 240px;
  overflow: hidden;
  padding: var(--menu-inset);
`

const SectionLabel = styled(Box)`
  padding-left: 44px;
`

const ReleaseMenuItemWrapper = styled.div``

const MenuRows = styled(Flex)`
  & > [data-release-row] + [data-release-row] {
    margin-top: 0.25rem;
  }
`

const ScrollSection = styled.div`
  max-height: min(320px, 50vh);
  margin-left: calc(var(--menu-inset) * -1);
  margin-right: calc(var(--menu-inset) * -1);
  padding-left: var(--menu-inset);
  padding-right: var(--menu-inset);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
`

const StickyTopCard = styled(Card)<{$continueLine?: boolean}>`
  background: var(--card-bg-color);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: calc(var(--menu-inset) * -1);
    right: calc(var(--menu-inset) * -1);
    bottom: 0;
    height: 1px;
    background: var(--card-border-color);
    pointer-events: none;
  }

  ${({$continueLine}) =>
    $continueLine &&
    `
      &::after {
        content: '';
        position: absolute;
        left: 20px;
        height: calc(0.375rem + 1px);
        bottom: -1px;
        width: 1px;
        background: var(--card-border-color);
        pointer-events: none;
      }
    `}
`

const ReleaseGroupCard = styled(Card)<{$continueLine?: boolean; $showDivider?: boolean}>`
  position: relative;

  ${({$continueLine}) =>
    $continueLine &&
    `
      &::before {
        content: '';
        position: absolute;
        left: 20px;
        top: 0;
        bottom: -1px;
        width: 1px;
        background: var(--card-border-color);
        pointer-events: none;
      }
    `}

  ${({$showDivider}) =>
    $showDivider &&
    `
      &::after {
        content: '';
        position: absolute;
        left: calc(var(--menu-inset) * -1);
        right: calc(var(--menu-inset) * -1);
        bottom: 0;
        height: 1px;
        background: var(--card-border-color);
        pointer-events: none;
      }
    `}
`

/**
 * Studio-style global perspective / release picker.
 *
 * Closed state: a pill-shaped Card with [avatar] [label] [chevron trigger].
 * Open state: a clamped-width menu with three bands:
 *   1. Sticky top — Published + Drafts.
 *   2. Scrollable middle — release groups (asap / scheduled / undecided).
 *
 * A 1px vertical connector runs through the currently-in-range rows
 * (Published → Drafts → selected release) via `GlobalPerspectiveMenuItemIndicator`
 * / `GlobalPerspectiveMenuLabelIndicator`.
 */
export function GlobalPerspectivePicker() {
  const {
    activeReleases,
    isPublishedPerspective,
    selectedPerspective,
    selectedRelease,
    selectedReleaseId,
    setSelectedPerspective,
    setSelectedReleaseId,
  } = useReleaseContext()

  const grouped = useMemo<Record<ReleaseType, ReleaseDocument[]>>(
    () => ({
      asap: activeReleases.filter((r) => r.metadata.releaseType === 'asap'),
      scheduled: activeReleases.filter((r) => r.metadata.releaseType === 'scheduled'),
      undecided: activeReleases.filter((r) => r.metadata.releaseType === 'undecided'),
    }),
    [activeReleases],
  )

  const activeLayer: PerspectiveLayer = isPublishedPerspective
    ? 'published'
    : (selectedRelease?.metadata.releaseType ?? 'drafts')
  const visibleGroups = useMemo(
    () =>
      ORDERED_RELEASE_TYPES.map((type) => ({type, releases: grouped[type]})).filter(
        ({releases}) => releases.length > 0,
      ),
    [grouped],
  )

  const pillLabel = isPublishedPerspective
    ? 'Published'
    : selectedRelease
      ? (selectedRelease.metadata.title ?? selectedRelease.name)
      : 'Drafts'
  const selectedTypeIndex =
    selectedRelease?.metadata.releaseType != null
      ? ORDERED_RELEASE_TYPES.indexOf(selectedRelease.metadata.releaseType)
      : -1

  return (
    <Stack space={2}>
      <Label size={2} muted>
        Perspective
      </Label>
      <PillShell data-testid="release-picker-pill" radius="full" border tone="inherit">
        <Flex align="center" gap={2}>
          <ReleaseAvatarIcon layer={activeLayer} variant="pill" />
          <Box paddingRight={2} paddingY={2} style={{maxWidth: 180, minWidth: 0}}>
            <Text size={1} weight="medium">
              {pillLabel}
            </Text>
          </Box>
          <MenuButton
            id="global-perspective-picker"
            button={
              <TriggerButton
                mode="bleed"
                padding={2}
                radius="full"
                iconRight={ChevronDownIcon}
                data-testid="release-picker-button"
                aria-label="Change perspective"
              />
            }
            menu={
              <StyledMenu
                data-testid="release-picker-menu"
                padding={1}
                style={{borderRadius: '0.375rem'}}
              >
                <StickyTopCard
                  $continueLine={selectedPerspective.kind === 'release'}
                  paddingTop={1}
                  paddingBottom={1}
                  data-testid="release-picker-top-band"
                >
                  <MenuRows direction="column">
                    <GlobalPerspectiveMenuItemIndicator
                      data-first="true"
                      data-last={isPublishedPerspective ? 'true' : undefined}
                      data-release-row
                      data-testid="indicator-published"
                    >
                      <MenuItem
                        padding={1}
                        pressed={isPublishedPerspective}
                        selected={isPublishedPerspective}
                        onClick={() => setSelectedPerspective({kind: 'published'})}
                        data-testid="option-published"
                      >
                        <PerspectiveRow layer="published" title="Published" />
                      </MenuItem>
                    </GlobalPerspectiveMenuItemIndicator>

                    <GlobalPerspectiveMenuItemIndicator
                      data-first={isPublishedPerspective ? 'true' : undefined}
                      data-last={
                        selectedPerspective.kind === 'drafts' || isPublishedPerspective
                          ? 'true'
                          : undefined
                      }
                      data-release-row
                      data-testid="indicator-drafts"
                    >
                      <MenuItem
                        padding={1}
                        pressed={selectedPerspective.kind === 'drafts'}
                        selected={selectedPerspective.kind === 'drafts'}
                        onClick={() => setSelectedReleaseId(null)}
                        data-testid="option-drafts"
                      >
                        <PerspectiveRow layer="drafts" title="Drafts" />
                      </MenuItem>
                    </GlobalPerspectiveMenuItemIndicator>
                  </MenuRows>
                </StickyTopCard>

                <ScrollSection data-testid="release-picker-scroll-section" data-ui="scroll-wrapper">
                  <Stack space={0}>
                    {visibleGroups.map(({type, releases}, groupIndex) => {
                      const groupTypeIndex = ORDERED_RELEASE_TYPES.indexOf(type)
                      const groupWithinRange =
                        selectedTypeIndex !== -1 && groupTypeIndex <= selectedTypeIndex
                      const selectedIndex =
                        selectedRelease?.metadata.releaseType === type
                          ? releases.findIndex((release) => release.name === selectedReleaseId)
                          : -1

                      return (
                        <ReleaseGroupCard
                          key={type}
                          $showDivider={groupIndex < visibleGroups.length - 1}
                          $continueLine={groupTypeIndex < selectedTypeIndex}
                          paddingTop={0}
                          paddingBottom={1}
                        >
                          <Stack space={0}>
                            {groupWithinRange ? (
                              <GlobalPerspectiveMenuLabelIndicator
                                data-testid={`indicator-label-${type}`}
                                paddingTop={3}
                                paddingBottom={2}
                                $withinRange
                              >
                                <Label muted size={1}>
                                  {RELEASE_TYPE_LABELS[type]}
                                </Label>
                              </GlobalPerspectiveMenuLabelIndicator>
                            ) : (
                              <SectionLabel paddingTop={3} paddingBottom={2}>
                                <Label muted size={1}>
                                  {RELEASE_TYPE_LABELS[type]}
                                </Label>
                              </SectionLabel>
                            )}
                            <MenuRows direction="column">
                              {releases.map((release, releaseIndex) => {
                                const isSelected = selectedReleaseId === release.name
                                const isWithinRange =
                                  selectedTypeIndex !== -1 &&
                                  (groupTypeIndex < selectedTypeIndex ||
                                    (groupTypeIndex === selectedTypeIndex &&
                                      selectedIndex !== -1 &&
                                      releaseIndex <= selectedIndex))

                                const menuItem = (
                                  <MenuItem
                                    padding={1}
                                    pressed={isSelected}
                                    selected={isSelected}
                                    onClick={() => setSelectedReleaseId(release.name)}
                                    data-testid={`release-${release.name}`}
                                  >
                                    <PerspectiveRow
                                      layer={type}
                                      title={release.metadata.title ?? release.name}
                                      subtitle={
                                        type === 'scheduled' && release.metadata.intendedPublishAt
                                          ? formatScheduledDate(release.metadata.intendedPublishAt)
                                          : undefined
                                      }
                                    />
                                  </MenuItem>
                                )

                                if (isWithinRange) {
                                  return (
                                    <GlobalPerspectiveMenuItemIndicator
                                      key={release.name}
                                      data-last={isSelected ? 'true' : undefined}
                                      data-release-row
                                      data-testid={`indicator-${release.name}`}
                                    >
                                      {menuItem}
                                    </GlobalPerspectiveMenuItemIndicator>
                                  )
                                }

                                return (
                                  <ReleaseMenuItemWrapper
                                    key={release.name}
                                    data-release-row
                                    data-testid={`indicator-${release.name}`}
                                  >
                                    {menuItem}
                                  </ReleaseMenuItemWrapper>
                                )
                              })}
                            </MenuRows>
                          </Stack>
                        </ReleaseGroupCard>
                      )
                    })}
                  </Stack>
                </ScrollSection>
              </StyledMenu>
            }
            popover={{
              placement: 'bottom-end',
              fallbackPlacements: ['bottom-end'],
              portal: true,
              constrainSize: true,
              tone: 'default',
              zOffset: 3000,
              animate: true,
            }}
          />
        </Flex>
      </PillShell>
    </Stack>
  )
}

/**
 * Row body used by every primary menu item in the picker: a left icon gutter
 * (via `ReleaseAvatarIcon`) plus a title/optional subtitle stack on the right.
 */
function PerspectiveRow({
  layer,
  title,
  subtitle,
}: {
  layer: PerspectiveLayer
  title: string
  subtitle?: string
}) {
  return (
    <Flex align="flex-start" gap={2} style={{width: '100%', alignItems: 'center'}}>
      <ReleaseAvatarIcon layer={layer} />
      <Stack
        flex={1}
        paddingY={2}
        paddingRight={2}
        style={{maxWidth: 200, minWidth: 0, gap: '0.5rem'}}
      >
        <Text size={1} weight="medium" textOverflow="ellipsis">
          {title}
        </Text>
        {subtitle && (
          <Text muted size={1} textOverflow="ellipsis">
            {subtitle}
          </Text>
        )}
      </Stack>
    </Flex>
  )
}

function formatScheduledDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
