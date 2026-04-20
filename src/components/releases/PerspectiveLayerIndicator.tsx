import {Box} from '@sanity/ui'
import styled, {css} from 'styled-components'

/**
 * Vertical 1px connector that runs through the left gutter of perspective menu
 * rows, linking the layers that are part of the current perspective range
 * (Published → Drafts → selected release). Purely visual — does not affect
 * selection or perspective state.
 *
 * Ports the CSS-only technique from Studio's `PerspectiveLayerIndicator`.
 *
 * Usage: wrap one row (or a contiguous run of rows) and set `data-first` /
 * `data-last` to terminate the line at the top/bottom ends of the range.
 * Lines are drawn via `::before` (segment above icon knockout) and `::after`
 * (segment below) on the child `[data-ui='MenuItem']`. The icon knockout
 * itself comes from `IconWrapperBox` in `ReleaseAvatarIcon`.
 */
export const GlobalPerspectiveMenuItemIndicator = styled.div`
  --indicator-left: 20px;
  --indicator-gap: 0.25rem;
  --indicator-gap-half: calc(var(--indicator-gap) / 2);
  --indicator-line-color: var(--card-border-color);

  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: var(--indicator-left);
    width: 1px;
    background: var(--indicator-line-color);
    pointer-events: none;
  }

  &::before {
    top: calc(var(--indicator-gap-half) * -1);
    height: var(--indicator-gap-half);
  }

  &::after {
    bottom: calc(var(--indicator-gap-half) * -1);
    height: var(--indicator-gap-half);
  }

  & > [data-ui='MenuItem'] {
    position: relative;
    border-radius: 6px;
    z-index: 1;
  }

  & > [data-ui='MenuItem']::before,
  & > [data-ui='MenuItem']::after {
    content: '';
    position: absolute;
    left: var(--indicator-left);
    width: 1px;
    background: var(--card-border-color);
    pointer-events: none;
  }

  & > [data-ui='MenuItem']::before {
    top: 0;
    height: 50%;
  }

  & > [data-ui='MenuItem']::after {
    bottom: 0;
    height: 50%;
  }

  &[data-first='true'] > [data-ui='MenuItem']::before {
    display: none;
  }

  &[data-first='true']::before {
    display: none;
  }

  &[data-last='true'] > [data-ui='MenuItem']::after {
    display: none;
  }

  &[data-last='true']::after {
    display: none;
  }
`

/**
 * Section-header wrapper for release-type groups (ASAP / AT TIME / UNDECIDED).
 * Indents the header text so it aligns with the row text column, and when
 * `$withinRange` is true, draws a continuation segment of the vertical
 * connector line beside the header.
 */
export const GlobalPerspectiveMenuLabelIndicator = styled(Box)<{$withinRange?: boolean}>`
  padding-left: 44px;
  position: relative;

  ${({$withinRange}) =>
    $withinRange &&
    css`
      &::before {
        content: '';
        position: absolute;
        left: 20px;
        top: 0;
        bottom: 0;
        width: 1px;
        background: var(--card-border-color);
        pointer-events: none;
      }
    `}
`
