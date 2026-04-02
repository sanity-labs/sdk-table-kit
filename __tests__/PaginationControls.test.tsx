import {screen} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi} from 'vitest'

import {PaginationControls} from '../src/components/table/PaginationControls'
import {renderWithTheme} from './helpers'

const mockNextPage = vi.fn()
const mockPreviousPage = vi.fn()
const mockSetPageSize = vi.fn()

function makePagination(overrides = {}) {
  return {
    currentPage: 2,
    totalPages: 5,
    hasNextPage: true,
    hasPreviousPage: true,
    totalCount: 125,
    pageSize: 20,
    setPageSize: mockSetPageSize,
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
    renderWithTheme(<PaginationControls pagination={makePagination()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('Behavior 2: Next button calls nextPage', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PaginationControls pagination={makePagination()} />)

    await user.click(screen.getByRole('button', {name: 'Next'}))
    expect(mockNextPage).toHaveBeenCalled()
  })

  it('Behavior 3: Previous button calls previousPage', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PaginationControls pagination={makePagination()} />)

    await user.click(screen.getByRole('button', {name: 'Previous'}))
    expect(mockPreviousPage).toHaveBeenCalled()
  })

  it('Behavior 4: Previous disabled on page 1', () => {
    renderWithTheme(
      <PaginationControls pagination={makePagination({currentPage: 1, hasPreviousPage: false})} />,
    )

    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled()
  })

  it('Behavior 5: Next disabled on last page', () => {
    renderWithTheme(
      <PaginationControls pagination={makePagination({currentPage: 5, hasNextPage: false})} />,
    )

    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled()
  })

  it('Behavior 6: loading state reduces opacity', () => {
    renderWithTheme(<PaginationControls pagination={makePagination()} loading />)

    // Buttons should be disabled during loading
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled()
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled()
  })

  it('Behavior 7: hidden when single page', () => {
    renderWithTheme(
      <PaginationControls
        pagination={makePagination({totalPages: 1, hasNextPage: false, hasPreviousPage: false})}
      />,
    )

    // Should render nothing
    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('Behavior 8: changing rows per page calls setPageSize', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PaginationControls pagination={makePagination()} />)

    await user.selectOptions(screen.getByRole('combobox'), '50')
    expect(mockSetPageSize).toHaveBeenCalledWith(50)
  })

  it('Behavior 9: shows all page buttons when totalPages is 6 or less', () => {
    renderWithTheme(
      <PaginationControls pagination={makePagination({currentPage: 3, totalPages: 6})} />,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.queryByText('...')).not.toBeInTheDocument()
  })

  it('Behavior 10: shows condensed page buttons with ellipses when totalPages exceeds 6', () => {
    renderWithTheme(
      <PaginationControls pagination={makePagination({currentPage: 5, totalPages: 20})} />,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '20'})).toBeInTheDocument()
    expect(screen.getAllByText('...')).toHaveLength(2)
  })
})
