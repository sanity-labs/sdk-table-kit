import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {AddToReleaseButton} from '../src/components/releases/AddToReleaseButton'
import {renderWithTheme} from './helpers'

// Mock useReleaseContext
const mockAddToRelease = vi.fn().mockResolvedValue(undefined)
const mockSetSelectedReleaseId = vi.fn()
const mockCreateRelease = vi.fn().mockResolvedValue(undefined)

const asapRelease = {
  _id: '_.releases.spring-campaign',
  _type: 'system.release',
  name: 'spring-campaign',
  state: 'active',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev1',
  metadata: {title: 'Spring Campaign', releaseType: 'asap' as const},
}

const scheduledRelease = {
  _id: '_.releases.cyber-monday',
  _type: 'system.release',
  name: 'cyber-monday',
  state: 'active',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'rev2',
  metadata: {
    title: 'Cyber Monday',
    releaseType: 'scheduled' as const,
    intendedPublishAt: '2026-11-30T00:00:00Z',
  },
}

vi.mock('../src/context/ReleaseContext', () => ({
  useReleaseContext: () => ({
    activeReleases: [asapRelease, scheduledRelease],
    selectedRelease: null,
    selectedReleaseId: null,
    setSelectedReleaseId: mockSetSelectedReleaseId,
    getQueryPerspective: () => 'published' as const,
    createRelease: mockCreateRelease,
    addToRelease: mockAddToRelease,
  }),
}))

// Mock @sanity/ui useToast
const mockToastPush = vi.fn()
vi.mock('@sanity/ui', async () => {
  const actual = await vi.importActual('@sanity/ui')
  return {
    ...actual,
    useToast: () => ({push: mockToastPush}),
  }
})

// jsdom doesn't have matchMedia — Sanity UI Popover needs it
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

describe('R-T6: AddToReleaseButton', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Behavior 1 [TRACER]: renders "Add to Release" button', () => {
    renderWithTheme(<AddToReleaseButton selectedIds={['doc1', 'doc2']} />)
    expect(screen.getByRole('button', {name: /add to release/i})).toBeInTheDocument()
  })

  it('Behavior 2: click opens popover with active releases list', async () => {
    renderWithTheme(<AddToReleaseButton selectedIds={['doc1']} />)
    await user.click(screen.getByRole('button', {name: /add to release/i}))
    expect(screen.getByText('Spring Campaign')).toBeInTheDocument()
    expect(screen.getByText('Cyber Monday')).toBeInTheDocument()
  })

  it('Behavior 3: selecting a release calls addToRelease with selected document IDs', async () => {
    renderWithTheme(<AddToReleaseButton selectedIds={['doc1', 'doc2', 'doc3']} />)
    await user.click(screen.getByRole('button', {name: /add to release/i}))
    await user.click(screen.getByText('Spring Campaign'))
    expect(mockAddToRelease).toHaveBeenCalledWith(['doc1', 'doc2', 'doc3'], 'spring-campaign')
  })

  it('Behavior 4: shows success toast on completion', async () => {
    renderWithTheme(<AddToReleaseButton selectedIds={['doc1', 'doc2']} />)
    await user.click(screen.getByRole('button', {name: /add to release/i}))
    await user.click(screen.getByText('Spring Campaign'))
    expect(mockToastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
      }),
    )
  })

  it('Behavior 5: clears selection via onComplete callback after success', async () => {
    const onComplete = vi.fn()
    renderWithTheme(<AddToReleaseButton selectedIds={['doc1']} onComplete={onComplete} />)
    await user.click(screen.getByRole('button', {name: /add to release/i}))
    await user.click(screen.getByText('Spring Campaign'))
    expect(onComplete).toHaveBeenCalled()
  })

  it('Behavior 6: error shows toast with error message', async () => {
    mockAddToRelease.mockRejectedValueOnce(new Error('Network error'))
    renderWithTheme(<AddToReleaseButton selectedIds={['doc1']} />)
    await user.click(screen.getByRole('button', {name: /add to release/i}))
    await user.click(screen.getByText('Spring Campaign'))
    expect(mockToastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
      }),
    )
  })

  it('Behavior 7: "Create new release" option in popover opens dialog callback', async () => {
    const onCreateRelease = vi.fn()
    renderWithTheme(<AddToReleaseButton selectedIds={['doc1']} onCreateRelease={onCreateRelease} />)
    await user.click(screen.getByRole('button', {name: /add to release/i}))
    await user.click(screen.getByText('Create new release'))
    expect(onCreateRelease).toHaveBeenCalled()
  })
})
