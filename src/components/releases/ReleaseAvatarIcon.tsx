import {BoltIcon, ClockIcon, DotIcon} from '@sanity/icons'
import {Box, Text} from '@sanity/ui'
import type {ComponentType} from 'react'
import styled from 'styled-components'

type ReleaseType = 'asap' | 'scheduled' | 'undecided'

type PerspectiveLayer = ReleaseType | 'drafts' | 'published'

/**
 * Maps a perspective layer to its Sanity badge tone token.
 * Mirrors Studio: asap → caution (amber bolt), scheduled → suggest (purple clock),
 * drafts → caution (dot), published in the menu → positive, undecided → default.
 */
const TONE_VAR: Record<PerspectiveLayer, string> = {
  asap: 'var(--card-badge-caution-icon-color)',
  scheduled: 'var(--card-badge-suggest-icon-color)',
  undecided: 'var(--card-badge-default-icon-color)',
  drafts: 'var(--card-badge-caution-icon-color)',
  published: 'var(--card-badge-default-icon-color)',
}

const ICON: Record<PerspectiveLayer, ComponentType> = {
  asap: BoltIcon,
  scheduled: ClockIcon,
  undecided: DotIcon,
  drafts: DotIcon,
  published: DotIcon,
}

/**
 * Circular icon wrapper that sits in the left gutter of each menu row.
 * Its `background-color: var(--card-bg-color)` knocks out the vertical
 * timeline connector line at the icon position so the line does not
 * show through the icon.
 */
const IconWrapperBox = styled(Box)`
  border-radius: 50%;
  background-color: var(--card-bg-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
`

interface ReleaseAvatarIconProps {
  /** Which perspective layer this icon represents. */
  layer: PerspectiveLayer
  /** Closed pill uses a tighter, non-knockout treatment. */
  variant?: 'menu' | 'pill'
}

/**
 * Small avatar used both in the closed-pill label slot and inside every
 * menu row in the release picker. Chooses `BoltIcon` / `ClockIcon` /
 * `DotIcon` based on the layer and tones it via `--card-icon-color`,
 * driven by the matching `--card-badge-<tone>-icon-color` theme token.
 *
 * Mirrors Studio's `ReleaseAvatarIcon` + `IconWrapperBox` pattern.
 */
export function ReleaseAvatarIcon({layer, variant = 'menu'}: ReleaseAvatarIconProps) {
  const Icon = ICON[layer]
  const iconToneVar =
    layer === 'published' && variant === 'menu'
      ? 'var(--card-badge-positive-icon-color)'
      : TONE_VAR[layer]

  return (
    <IconWrapperBox
      paddingX={variant === 'pill' ? 2 : 3}
      paddingY={2}
      style={{
        backgroundColor: variant === 'menu' ? 'var(--card-bg-color)' : 'transparent',
        ['--card-icon-color' as string]: iconToneVar,
      }}
    >
      <Text size={1}>
        <Icon />
      </Text>
    </IconWrapperBox>
  )
}

export type {PerspectiveLayer}
