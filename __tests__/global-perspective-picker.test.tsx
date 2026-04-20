import {screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {GlobalPerspectivePicker} from '../src/components/releases/GlobalPerspectivePicker'
import {renderWithTheme} from './helpers'

const mockSetSelectedReleaseId = vi.fn()
const mockCreateRelease = vi.fn()
const mockUseReleaseContext = vi.fn()

vi.mock('../src/context/ReleaseContext', () => ({
  useReleaseContext: () => mockUseReleaseContext(),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const asapRelease = {
  _id: '_.releases.spring',
  _type: 'system.release',
  name: 'spring',
  state: 'active',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'r1',
  metadata: {title: 'Spring Campaign', releaseType: 'asap'},
}

const scheduledRelease = {
  _id: '_.releases.cyber',
  _type: 'system.release',
  name: 'cyber',
  state: 'active',
  _createdAt: '2026-01-02T00:00:00Z',
  _updatedAt: '2026-03-02T00:00:00Z',
  _rev: 'r2',
  metadata: {
    title: 'Cyber Monday',
    releaseType: 'scheduled',
    intendedPublishAt: '2026-11-30T12:00:00Z',
  },
}

const undecidedRelease = {
  _id: '_.releases.ideas',
  _type: 'system.release',
  name: 'ideas',
  state: 'active',
  _createdAt: '2026-01-03T00:00:00Z',
  _updatedAt: '2026-03-03T00:00:00Z',
  _rev: 'r3',
  metadata: {title: 'Ideas Backlog', releaseType: 'undecided'},
}

const allReleases = [asapRelease, scheduledRelease, undecidedRelease]

describe('GlobalPerspectivePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseReleaseContext.mockReturnValue({
      activeReleases: allReleases,
      selectedRelease: null,
      selectedReleaseId: null,
      setSelectedReleaseId: mockSetSelectedReleaseId,
      createRelease: mockCreateRelease,
    })
  })

  it('renders the pill with the Drafts label when nothing is selected', () => {
    renderWithTheme(<GlobalPerspectivePicker />)
    expect(screen.getByText('Drafts')).toBeInTheDocument()
    expect(screen.getByTestId('release-picker-button')).toBeInTheDocument()
  })

  it('renders the pill with the selected release title', () => {
    mockUseReleaseContext.mockReturnValue({
      activeReleases: allReleases,
      selectedRelease: asapRelease,
      selectedReleaseId: 'spring',
      setSelectedReleaseId: mockSetSelectedReleaseId,
      createRelease: mockCreateRelease,
    })
    renderWithTheme(<GlobalPerspectivePicker />)
    expect(screen.getByText('Spring Campaign')).toBeInTheDocument()
  })

  it('shows Published (disabled) and Drafts in the sticky top band', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    expect(screen.getByTestId('release-picker-top-band')).toBeInTheDocument()
    const published = screen.getByTestId('option-published')
    const drafts = screen.getByTestId('option-drafts')
    expect(published).toBeInTheDocument()
    expect(published).toHaveAttribute('data-disabled')
    expect(drafts).toBeInTheDocument()
  })

  it('groups releases by type in order: ASAP → AT TIME → UNDECIDED', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    const menu = screen.getByTestId('release-picker-menu')
    const allText = menu.textContent ?? ''

    expect(allText).toContain('AS SOON AS POSSIBLE')
    expect(allText).toContain('AT TIME')
    expect(allText).toContain('UNDECIDED')

    const asapIdx = allText.indexOf('Spring Campaign')
    const scheduledIdx = allText.indexOf('Cyber Monday')
    const undecidedIdx = allText.indexOf('Ideas Backlog')

    expect(asapIdx).toBeLessThan(scheduledIdx)
    expect(scheduledIdx).toBeLessThan(undecidedIdx)
  })

  it('clicking a release item updates the selected release', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))
    await user.click(screen.getByTestId('release-spring'))

    expect(mockSetSelectedReleaseId).toHaveBeenCalledWith('spring')
  })

  it('clicking Drafts clears the selected release', async () => {
    const user = userEvent.setup()
    mockUseReleaseContext.mockReturnValue({
      activeReleases: allReleases,
      selectedRelease: asapRelease,
      selectedReleaseId: 'spring',
      setSelectedReleaseId: mockSetSelectedReleaseId,
      createRelease: mockCreateRelease,
    })
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))
    await user.click(screen.getByTestId('option-drafts'))

    expect(mockSetSelectedReleaseId).toHaveBeenCalledWith(null)
  })

  it('selected release row is marked as selected', async () => {
    const user = userEvent.setup()
    mockUseReleaseContext.mockReturnValue({
      activeReleases: allReleases,
      selectedRelease: asapRelease,
      selectedReleaseId: 'spring',
      setSelectedReleaseId: mockSetSelectedReleaseId,
      createRelease: mockCreateRelease,
    })
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    const springItem = screen.getByTestId('release-spring')
    expect(springItem).toHaveAttribute('data-selected')
  })

  it('published menu item is disabled and does not fire onClick', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))
    await user.click(screen.getByTestId('option-published'))

    expect(mockSetSelectedReleaseId).not.toHaveBeenCalled()
  })

  it('New release footer item is rendered but disabled', async () => {
    const user = userEvent.setup()
    const onCreateRelease = vi.fn()
    renderWithTheme(<GlobalPerspectivePicker onCreateRelease={onCreateRelease} />)
    await user.click(screen.getByTestId('release-picker-button'))

    expect(screen.getByTestId('release-picker-footer-band')).toBeInTheDocument()
    const createBtn = screen.getByTestId('create-release-button')
    expect(createBtn).toBeInTheDocument()
    expect(createBtn).toHaveAttribute('data-disabled')

    await user.click(createBtn)
    expect(onCreateRelease).not.toHaveBeenCalled()
  })

  it('menu closes after selecting a release', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    expect(screen.getByTestId('release-picker-menu')).toBeInTheDocument()

    await user.click(screen.getByTestId('release-spring'))

    await waitFor(() => {
      expect(screen.queryByTestId('release-picker-menu')).not.toBeInTheDocument()
    })
  })

  it('keeps the connector ending on Drafts when no release is selected', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    expect(screen.getByTestId('indicator-published')).toHaveAttribute('data-first', 'true')
    expect(screen.getByTestId('indicator-drafts')).toHaveAttribute('data-last', 'true')
  })

  it('extends the connector through grouped releases down to the selected perspective', async () => {
    const user = userEvent.setup()
    mockUseReleaseContext.mockReturnValue({
      activeReleases: allReleases,
      selectedRelease: scheduledRelease,
      selectedReleaseId: 'cyber',
      setSelectedReleaseId: mockSetSelectedReleaseId,
      createRelease: mockCreateRelease,
    })
    renderWithTheme(<GlobalPerspectivePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    expect(screen.getByTestId('indicator-drafts')).not.toHaveAttribute('data-last')
    expect(screen.getByTestId('indicator-spring')).not.toHaveAttribute('data-last')
    expect(screen.getByTestId('indicator-cyber')).toHaveAttribute('data-last', 'true')
  })
})
