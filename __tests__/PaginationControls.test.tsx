import {render, screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi} from 'vitest'

import {PaginationControls} from '../src/PaginationControls'

const mockNextPage = vi.fn()
const mockPreviousPage = vi.fn()

function makePagination(overrides = {}) {
  return {
    currentPage: 2,
    totalPages: 5,
    hasNextPage: true,
    hasPreviousPage: true,
    totalCount: 125,
    nextPage: mockNextPage,
    previousPage: mockPreviousPage,
    ...overrides,
  }
}

describe('PaginationControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Behavior 1: shows page indicator', () => {
    render(<PaginationControls pagination={makePagination()} />)
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
  })

  it('Behavior 2: Next button calls nextPage', async () => {
    const user = userEvent.setup()
    render(<PaginationControls pagination={makePagination()} />)

    await user.click(screen.getByText('Next'))
    expect(mockNextPage).toHaveBeenCalled()
  })

  it('Behavior 3: Previous button calls previousPage', async () => {
    const user = userEvent.setup()
    render(<PaginationControls pagination={makePagination()} />)

    await user.click(screen.getByText('Previous'))
    expect(mockPreviousPage).toHaveBeenCalled()
  })

  it('Behavior 4: Previous disabled on page 1', () => {
    render(
      <PaginationControls pagination={makePagination({currentPage: 1, hasPreviousPage: false})} />,
    )

    expect(screen.getByText('Previous')).toBeDisabled()
  })

  it('Behavior 5: Next disabled on last page', () => {
    render(<PaginationControls pagination={makePagination({currentPage: 5, hasNextPage: false})} />)

    expect(screen.getByText('Next')).toBeDisabled()
  })

  it('Behavior 6: loading state reduces opacity', () => {
    render(<PaginationControls pagination={makePagination()} loading />)

    // Buttons should be disabled during loading
    expect(screen.getByText('Next')).toBeDisabled()
    expect(screen.getByText('Previous')).toBeDisabled()
  })

  it('Behavior 7: hidden when single page', () => {
    render(
      <PaginationControls
        pagination={makePagination({totalPages: 1, hasNextPage: false, hasPreviousPage: false})}
      />,
    )

    // Should render nothing
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })
})
