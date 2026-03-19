import React from 'react'
import type {PaginationState} from './useSanityTableData'

/**
 * Props for the PaginationControls component.
 */
export interface PaginationControlsProps {
  pagination: PaginationState
  loading?: boolean
}

/**
 * Server-side pagination controls.
 * Shows page indicator, Previous/Next buttons, and total count.
 * Hidden when there's only one page.
 */
export function PaginationControls({pagination, loading}: PaginationControlsProps) {
  const {currentPage, totalPages, hasNextPage, hasPreviousPage, nextPage, previousPage} = pagination

  // Don't render if single page
  if (totalPages <= 1) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderTop: '1px solid var(--card-border-color, #e0e0e0)',
        fontSize: '13px',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <button
        onClick={previousPage}
        disabled={!hasPreviousPage || loading}
        style={{
          padding: '4px 12px',
          cursor: hasPreviousPage && !loading ? 'pointer' : 'default',
          opacity: hasPreviousPage ? 1 : 0.4,
        }}
      >
        Previous
      </button>

      <span>
        Page {currentPage} of {totalPages}
      </span>

      <button
        onClick={nextPage}
        disabled={!hasNextPage || loading}
        style={{
          padding: '4px 12px',
          cursor: hasNextPage && !loading ? 'pointer' : 'default',
          opacity: hasNextPage ? 1 : 0.4,
        }}
      >
        Next
      </button>
    </div>
  )
}
