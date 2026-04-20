import {screen} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {ReleaseHeader} from '../src/components/releases/ReleaseHeader'
import {renderWithTheme} from './helpers'

const mockUseReleaseContext = vi.fn()

vi.mock('../src/context/ReleaseContext', () => ({
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

const asapRelease = {
  _id: '_.releases.spring-campaign',
  _type: 'system.release' as const,
  name: 'spring-campaign',
  state: 'active' as const,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev1',
  metadata: {
    title: 'Spring Campaign',
    releaseType: 'asap' as const,
  },
}

const scheduledRelease = {
  _id: '_.releases.cyber-monday',
  _type: 'system.release' as const,
  name: 'cyber-monday',
  state: 'active' as const,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev2',
  metadata: {
    title: 'Cyber Monday',
    releaseType: 'scheduled' as const,
    intendedPublishAt: '2026-11-30T00:00:00Z',
  },
}

const undecidedRelease = {
  _id: '_.releases.untitled',
  _type: 'system.release' as const,
  name: 'untitled',
  state: 'active' as const,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev3',
  metadata: {
    title: 'Untitled release',
    releaseType: 'undecided' as const,
  },
}

describe('ReleaseHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Behavior 1 [TRACER]: renders with default tone when no release selected', () => {
    mockUseReleaseContext.mockReturnValue({selectedRelease: null})
    renderWithTheme(<ReleaseHeader />)
    const header = screen.getByTestId('release-header')
    expect(header).toBeInTheDocument()
    // When no release is selected, Card renders with default tone
    expect(header).toHaveAttribute('data-tone', 'default')
  })

  it('Behavior 2: renders tone="caution" for ASAP release', () => {
    mockUseReleaseContext.mockReturnValue({selectedRelease: asapRelease})
    renderWithTheme(<ReleaseHeader />)
    const header = screen.getByTestId('release-header')
    expect(header).toHaveAttribute('data-tone', 'caution')
  })

  it('Behavior 3: renders tone="suggest" for scheduled release', () => {
    mockUseReleaseContext.mockReturnValue({selectedRelease: scheduledRelease})
    renderWithTheme(<ReleaseHeader />)
    const header = screen.getByTestId('release-header')
    expect(header).toHaveAttribute('data-tone', 'suggest')
  })

  it('Behavior 4: renders tone="neutral" for undecided release', () => {
    mockUseReleaseContext.mockReturnValue({selectedRelease: undecidedRelease})
    renderWithTheme(<ReleaseHeader />)
    const header = screen.getByTestId('release-header')
    expect(header).toHaveAttribute('data-tone', 'neutral')
  })

  it('Behavior 5: shows release title and type badge when selected', () => {
    mockUseReleaseContext.mockReturnValue({selectedRelease: asapRelease})
    renderWithTheme(<ReleaseHeader />)
    expect(screen.getByText('Staging to Spring Campaign')).toBeInTheDocument()
    expect(screen.getByText('ASAP')).toBeInTheDocument()
  })

  it('Behavior 6: shows staging label for drafts when no release selected', () => {
    mockUseReleaseContext.mockReturnValue({selectedRelease: null})
    renderWithTheme(<ReleaseHeader />)
    expect(screen.getByText('Staging to Drafts')).toBeInTheDocument()
  })

  it('Behavior 7: filter bar and search are inside the table card border', () => {
    mockUseReleaseContext.mockReturnValue({selectedRelease: null})
    renderWithTheme(
      <ReleaseHeader>
        <div data-testid="filter-bar">Filter</div>
      </ReleaseHeader>,
    )
    const header = screen.getByTestId('release-header')
    const filterBar = screen.getByTestId('filter-bar')
    // FilterBar should be inside the ReleaseHeader Card
    expect(header).toContainElement(filterBar)
  })
})
