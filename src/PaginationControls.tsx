import {Box, Button, Flex, Select, Text} from '@sanity/ui'
import React from 'react'

import type {PaginationState} from './useSanityTableData'

const PAGE_BREAKPOINT = 6

type PageItem = {kind: 'ellipsis'; key: string} | {kind: 'page'; pageNumber: number}

function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= PAGE_BREAKPOINT) {
    return Array.from({length: totalPages}, (_, index) => ({
      kind: 'page' as const,
      pageNumber: index + 1,
    }))
  }

  const pages = new Set<number>([1, totalPages])

  if (currentPage <= 4) {
    for (let page = 1; page <= Math.min(5, totalPages); page++) {
      pages.add(page)
    }
  } else if (currentPage >= totalPages - 3) {
    for (let page = Math.max(1, totalPages - 4); page <= totalPages; page++) {
      pages.add(page)
    }
  } else {
    pages.add(currentPage - 2)
    pages.add(currentPage - 1)
    pages.add(currentPage)
    pages.add(currentPage + 1)
    pages.add(currentPage + 2)
  }

  const sortedPages = [...pages].sort((a, b) => a - b)
  const items: PageItem[] = []

  for (let i = 0; i < sortedPages.length; i++) {
    const pageNumber = sortedPages[i]
    const previousPage = sortedPages[i - 1]

    if (i > 0 && pageNumber - previousPage > 1) {
      items.push({kind: 'ellipsis', key: `ellipsis-${previousPage}-${pageNumber}`})
    }

    items.push({kind: 'page', pageNumber})
  }

  return items
}

/**
 * Props for the PaginationControls component.
 */
export interface PaginationControlsProps {
  pagination: PaginationState
  loading?: boolean
  pageSizeOptions?: number[]
}

/**
 * Server-side pagination controls.
 * Shows page indicator, Previous/Next buttons, and total count.
 * Hidden when there's only one page.
 */
export function PaginationControls({
  pagination,
  loading,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationControlsProps) {
  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    pageSize,
    setPageSize,
  } = pagination
  const pageItems = buildPageItems(currentPage, totalPages)

  // Don't render if single page
  if (totalPages <= 1) return null

  return (
    <Box paddingTop={3}>
      <Flex align="center" justify="space-between">
        <Flex align="center" justify="center" flex={1} gap={1}>
          <Button
            text="Previous"
            mode="ghost"
            tone="primary"
            onClick={previousPage}
            disabled={!hasPreviousPage || loading}
          />

          <Flex align="center" gap={1}>
            {pageItems.map((item) =>
              item.kind === 'ellipsis' ? (
                <Text key={item.key} muted size={1}>
                  ...
                </Text>
              ) : (
                <Button
                  key={item.pageNumber}
                  text={String(item.pageNumber)}
                  mode={item.pageNumber === currentPage ? 'default' : 'ghost'}
                  tone="default"
                  onClick={() => pagination.goToPage(item.pageNumber)}
                  disabled={loading}
                />
              ),
            )}
          </Flex>

          <Button
            text="Next"
            mode="ghost"
            tone="primary"
            onClick={nextPage}
            disabled={!hasNextPage || loading}
          />
        </Flex>

        <Flex align="center" gap={2}>
          <Text muted size={1}>
            Rows
          </Text>
          <Select
            value={pageSize}
            disabled={loading}
            onChange={(event) => setPageSize(Number(event.currentTarget.value))}
            style={{minWidth: '80px'}}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Flex>
      </Flex>
    </Box>
  )
}
