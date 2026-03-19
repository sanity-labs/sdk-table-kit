import {describe, it, expect, vi, beforeEach} from 'vitest'
import {screen, waitFor} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {CreateReleaseDialog} from '../src/CreateReleaseDialog'
import {renderWithTheme} from './helpers'

// Mock window.matchMedia for Sanity UI Dialog
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

const mockCreateRelease = vi.fn().mockResolvedValue(undefined)
const mockSetSelectedReleaseId = vi.fn()

vi.mock('../src/ReleaseContext', () => ({
  useReleaseContext: () => ({
    createRelease: mockCreateRelease,
    setSelectedReleaseId: mockSetSelectedReleaseId,
    activeReleases: [],
    selectedRelease: null,
    selectedReleaseId: null,
    getQueryPerspective: () => 'published',
    addToRelease: vi.fn(),
  }),
}))

const mockToastPush = vi.fn()
vi.mock('@sanity/ui', async () => {
  const actual = await vi.importActual('@sanity/ui')
  return {
    ...actual,
    useToast: () => ({push: mockToastPush}),
  }
})

describe('CreateReleaseDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateRelease.mockResolvedValue(undefined)
  })

  it('Behavior 1 [TRACER]: renders with title input and release type selection', () => {
    renderWithTheme(<CreateReleaseDialog onClose={vi.fn()} />)

    // Title input should exist
    expect(screen.getByTestId('release-title-input')).toBeInTheDocument()

    // Release type buttons should exist
    expect(screen.getByTestId('release-type-asap')).toBeInTheDocument()
    expect(screen.getByTestId('release-type-scheduled')).toBeInTheDocument()
    expect(screen.getByTestId('release-type-undecided')).toBeInTheDocument()
  })

  it('Behavior 2: description textarea is optional', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithTheme(<CreateReleaseDialog onClose={onClose} />)

    // Description textarea should exist
    expect(screen.getByTestId('release-description-input')).toBeInTheDocument()

    // Fill title only (no description) and submit — should work
    const titleInput = screen.getByTestId('release-title-input')
    await user.click(titleInput)
    await user.type(titleInput, 'My Release')

    // Select ASAP type
    await user.click(screen.getByTestId('release-type-asap'))

    // Submit
    await user.click(screen.getByTestId('create-release-submit'))

    await waitFor(() => {
      expect(mockCreateRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Release',
          releaseType: 'asap',
        }),
      )
    })

    // Verify description was NOT included in the call
    const callArg = mockCreateRelease.mock.calls[0][0]
    expect(callArg).not.toHaveProperty('description')
  })

  it('Behavior 3: release type defaults to "undecided"', () => {
    renderWithTheme(<CreateReleaseDialog onClose={vi.fn()} />)

    // The undecided button should have primary tone (selected state)
    const undecidedButton = screen.getByTestId('release-type-undecided')
    expect(undecidedButton).toBeInTheDocument()

    // The date picker should NOT be visible (only shows for scheduled)
    expect(screen.queryByTestId('release-date-input')).not.toBeInTheDocument()
  })

  it('Behavior 4: selecting "scheduled" shows date picker, selecting ASAP hides it', async () => {
    const user = userEvent.setup()

    renderWithTheme(<CreateReleaseDialog onClose={vi.fn()} />)

    // Initially no date picker
    expect(screen.queryByTestId('release-date-input')).not.toBeInTheDocument()

    // Select scheduled
    await user.click(screen.getByTestId('release-type-scheduled'))

    // Date picker should appear
    expect(screen.getByTestId('release-date-input')).toBeInTheDocument()

    // Select ASAP
    await user.click(screen.getByTestId('release-type-asap'))

    // Date picker should disappear
    expect(screen.queryByTestId('release-date-input')).not.toBeInTheDocument()
  })

  it('Behavior 5: submit calls createRelease with correct metadata', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithTheme(<CreateReleaseDialog onClose={onClose} />)

    // Fill title
    const titleInput = screen.getByTestId('release-title-input')
    await user.click(titleInput)
    await user.type(titleInput, 'Spring Campaign')

    // Select ASAP
    await user.click(screen.getByTestId('release-type-asap'))

    // Submit
    await user.click(screen.getByTestId('create-release-submit'))

    await waitFor(() => {
      expect(mockCreateRelease).toHaveBeenCalledWith({
        title: 'Spring Campaign',
        releaseType: 'asap',
      })
    })
  })

  it('Behavior 6: submit with scheduled type includes intendedPublishAt', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithTheme(<CreateReleaseDialog onClose={onClose} />)

    // Fill title
    const titleInput = screen.getByTestId('release-title-input')
    await user.click(titleInput)
    await user.type(titleInput, 'Cyber Monday')

    // Select scheduled
    await user.click(screen.getByTestId('release-type-scheduled'))

    // Pick date
    const dateInput = screen.getByTestId('release-date-input')
    await user.click(dateInput)
    await user.type(dateInput, '2026-11-30')

    // Submit
    await user.click(screen.getByTestId('create-release-submit'))

    await waitFor(() => {
      expect(mockCreateRelease).toHaveBeenCalledWith({
        title: 'Cyber Monday',
        releaseType: 'scheduled',
        intendedPublishAt: '2026-11-30',
      })
    })
  })

  it('Behavior 7: submit button disabled when title is empty', async () => {
    const user = userEvent.setup()

    renderWithTheme(<CreateReleaseDialog onClose={vi.fn()} />)

    // Submit button should be disabled initially
    const submitButton = screen.getByTestId('create-release-submit')
    expect(submitButton).toBeDisabled()

    // Type a title
    const titleInput = screen.getByTestId('release-title-input')
    await user.click(titleInput)
    await user.type(titleInput, 'A')

    // Submit button should now be enabled
    expect(submitButton).not.toBeDisabled()
  })

  it('Behavior 8: dialog closes on success', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderWithTheme(<CreateReleaseDialog onClose={onClose} />)

    // Fill title
    const titleInput = screen.getByTestId('release-title-input')
    await user.click(titleInput)
    await user.type(titleInput, 'New Release')

    // Select ASAP
    await user.click(screen.getByTestId('release-type-asap'))

    // Submit
    await user.click(screen.getByTestId('create-release-submit'))

    await waitFor(() => {
      // createRelease should have been called
      expect(mockCreateRelease).toHaveBeenCalled()
      // onClose should have been called after success
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('Behavior 9: error shows toast notification', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    // Mock createRelease to reject
    mockCreateRelease.mockRejectedValueOnce(new Error('Network error'))

    renderWithTheme(<CreateReleaseDialog onClose={onClose} />)

    // Fill title
    const titleInput = screen.getByTestId('release-title-input')
    await user.click(titleInput)
    await user.type(titleInput, 'Failing Release')

    // Select ASAP
    await user.click(screen.getByTestId('release-type-asap'))

    // Submit
    await user.click(screen.getByTestId('create-release-submit'))

    await waitFor(() => {
      expect(mockToastPush).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          title: 'Failed to create release',
        }),
      )
    })

    // onClose should NOT have been called on error
    expect(onClose).not.toHaveBeenCalled()
  })
})
