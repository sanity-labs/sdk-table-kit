import {describe, it, expect, vi, beforeEach} from 'vitest'
import {screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {ReleasePicker} from '../src/ReleasePicker'
import {renderWithTheme} from './helpers'

const mockSetSelectedReleaseId = vi.fn()
const mockCreateRelease = vi.fn()
const mockUseReleaseContext = vi.fn()

vi.mock('../src/ReleaseContext', () => ({
  useReleaseContext: () => mockUseReleaseContext(),
}))

// Mock window.matchMedia for Sanity UI
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

const asapReleases = [
  {
    _id: '_.releases.spring',
    _type: 'system.release',
    name: 'spring',
    state: 'active',
    _createdAt: '2026-01-01T00:00:00Z',
    _updatedAt: '2026-03-01T00:00:00Z',
    _rev: 'r1',
    metadata: {title: 'Spring Campaign', releaseType: 'asap'},
  },
  {
    _id: '_.releases.flash',
    _type: 'system.release',
    name: 'flash',
    state: 'active',
    _createdAt: '2026-01-02T00:00:00Z',
    _updatedAt: '2026-03-02T00:00:00Z',
    _rev: 'r2',
    metadata: {title: 'Flash Sale', releaseType: 'asap'},
  },
]

const scheduledReleases = [
  {
    _id: '_.releases.cyber',
    _type: 'system.release',
    name: 'cyber',
    state: 'active',
    _createdAt: '2026-01-03T00:00:00Z',
    _updatedAt: '2026-03-03T00:00:00Z',
    _rev: 'r3',
    metadata: {
      title: 'Cyber Monday',
      releaseType: 'scheduled',
      intendedPublishAt: '2026-11-30T00:00:00Z',
    },
  },
  {
    _id: '_.releases.xmas',
    _type: 'system.release',
    name: 'xmas',
    state: 'active',
    _createdAt: '2026-01-04T00:00:00Z',
    _updatedAt: '2026-03-04T00:00:00Z',
    _rev: 'r4',
    metadata: {
      title: 'Christmas',
      releaseType: 'scheduled',
      intendedPublishAt: '2026-12-25T00:00:00Z',
    },
  },
]

const undecidedReleases = [
  {
    _id: '_.releases.ideas',
    _type: 'system.release',
    name: 'ideas',
    state: 'active',
    _createdAt: '2026-01-05T00:00:00Z',
    _updatedAt: '2026-03-05T00:00:00Z',
    _rev: 'r5',
    metadata: {title: 'Ideas Backlog', releaseType: 'undecided'},
  },
  {
    _id: '_.releases.draft-batch',
    _type: 'system.release',
    name: 'draft-batch',
    state: 'active',
    _createdAt: '2026-01-06T00:00:00Z',
    _updatedAt: '2026-03-06T00:00:00Z',
    _rev: 'r6',
    metadata: {title: 'Draft Batch', releaseType: 'undecided'},
  },
]

const allReleases = [...asapReleases, ...scheduledReleases, ...undecidedReleases]

describe('ReleasePicker', () => {
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

  it('Behavior 1 [TRACER]: renders MenuButton with ChevronDownIcon', () => {
    renderWithTheme(<ReleasePicker />)
    const button = screen.getByTestId('release-picker-button')
    expect(button).toBeInTheDocument()
    // Button should contain an SVG icon (ChevronDownIcon)
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('Behavior 2: menu shows "Published" and "Drafts" as top items', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReleasePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    expect(screen.getByTestId('option-published')).toBeInTheDocument()
    expect(screen.getByTestId('option-drafts')).toBeInTheDocument()
  })

  it('Behavior 3: menu shows releases grouped by type: ASAP → Scheduled → Undecided', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReleasePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    const menu = screen.getByTestId('release-picker-menu')
    const allText = menu.textContent || ''

    expect(allText).toContain('ASAP')
    expect(allText).toContain('Scheduled')
    expect(allText).toContain('Undecided')

    const asapIdx = allText.indexOf('Spring Campaign')
    const scheduledIdx = allText.indexOf('Cyber Monday')
    const undecidedIdx = allText.indexOf('Ideas Backlog')

    expect(asapIdx).toBeLessThan(scheduledIdx)
    expect(scheduledIdx).toBeLessThan(undecidedIdx)
  })

  it('Behavior 4: each release item shows colored dot + title', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReleasePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    for (const r of asapReleases) {
      const dot = screen.getByTestId(`dot-${r.name}`)
      expect(dot).toBeInTheDocument()
      expect(dot.style.background).toBe('rgb(245, 158, 11)')
      expect(screen.getByText(r.metadata.title)).toBeInTheDocument()
    }

    for (const r of scheduledReleases) {
      const dot = screen.getByTestId(`dot-${r.name}`)
      expect(dot).toBeInTheDocument()
      expect(dot.style.background).toBe('rgb(139, 92, 246)')
      expect(screen.getByText(r.metadata.title)).toBeInTheDocument()
    }

    for (const r of undecidedReleases) {
      const dot = screen.getByTestId(`dot-${r.name}`)
      expect(dot).toBeInTheDocument()
      expect(dot.style.background).toBe('rgb(107, 114, 128)')
      expect(screen.getByText(r.metadata.title)).toBeInTheDocument()
    }
  })

  it('Behavior 5: clicking a release calls setSelectedReleaseId', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReleasePicker />)
    await user.click(screen.getByTestId('release-picker-button'))
    await user.click(screen.getByTestId('release-spring'))

    expect(mockSetSelectedReleaseId).toHaveBeenCalledWith('spring')
  })

  it('Behavior 6: clicking "Drafts" clears the selected release', async () => {
    const user = userEvent.setup()
    mockUseReleaseContext.mockReturnValue({
      activeReleases: allReleases,
      selectedRelease: asapReleases[0],
      selectedReleaseId: 'spring',
      setSelectedReleaseId: mockSetSelectedReleaseId,
      createRelease: mockCreateRelease,
    })
    renderWithTheme(<ReleasePicker />)
    await user.click(screen.getByTestId('release-picker-button'))
    await user.click(screen.getByTestId('option-drafts'))

    expect(mockSetSelectedReleaseId).toHaveBeenCalledWith(null)
  })

  it('Behavior 7: selected release is highlighted in the menu', async () => {
    const user = userEvent.setup()
    mockUseReleaseContext.mockReturnValue({
      activeReleases: allReleases,
      selectedRelease: asapReleases[0],
      selectedReleaseId: 'spring',
      setSelectedReleaseId: mockSetSelectedReleaseId,
      createRelease: mockCreateRelease,
    })
    renderWithTheme(<ReleasePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    const springItem = screen.getByTestId('release-spring')
    expect(springItem).toHaveAttribute('data-selected')
  })

  it('Behavior 8: "Create new release" button calls onCreateRelease callback', async () => {
    const user = userEvent.setup()
    const mockOnCreateRelease = vi.fn()
    renderWithTheme(<ReleasePicker onCreateRelease={mockOnCreateRelease} />)
    await user.click(screen.getByTestId('release-picker-button'))
    await user.click(screen.getByTestId('create-release-button'))

    expect(mockOnCreateRelease).toHaveBeenCalledTimes(1)
  })

  it('Behavior 9: menu closes after selection', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ReleasePicker />)
    await user.click(screen.getByTestId('release-picker-button'))

    expect(screen.getByTestId('release-picker-menu')).toBeInTheDocument()

    await user.click(screen.getByTestId('release-spring'))

    await waitFor(() => {
      expect(screen.queryByTestId('release-picker-menu')).not.toBeInTheDocument()
    })
  })
})
