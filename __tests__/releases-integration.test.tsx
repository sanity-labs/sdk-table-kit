import {filter, type ColumnDef, type FilterDef} from '@sanity-labs/react-table-kit'
import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {render, screen, within} from '@testing-library/react'
import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import React from 'react'
import {describe, it, expect, vi, beforeEach, beforeAll} from 'vitest'

let mockReleaseParam: string | null = null
const publishedPerspectiveParam = '__published__'

vi.mock(import('nuqs'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useQueryState: (key: string) => [key === 'release' ? mockReleaseParam : null, vi.fn()],
  }
})

// Mock SDK hooks
const mockCurrentUser = vi.fn()
const mockUsePaginatedDocuments = vi.fn()
const mockUseQuery = vi.fn()
const mockUseDocumentProjection = vi.fn()
const mockUseActiveReleases = vi.fn()

const mockClient = {
  action: vi.fn().mockResolvedValue({}),
  config: () => ({projectId: 'test', dataset: 'production'}),
}

vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => mockCurrentUser(),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue({}),
  usePaginatedDocuments: (...args: unknown[]) => mockUsePaginatedDocuments(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useDocumentPreview: () => ({data: {title: 'Preview'}}),
  useDocumentProjection: (...args: unknown[]) => mockUseDocumentProjection(...args),
  useUsers: () => ({data: []}),
  useActiveReleases: () => mockUseActiveReleases(),
  useClient: () => mockClient,
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: vi.fn(),
}))

import {SanityDocumentTable} from '../src/components/table/SanityDocumentTable'
import {column} from '../src/helpers/table/column'

const theme = buildTheme()

// jsdom matchMedia
beforeAll(() => {
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
})

const mockData = [
  {_id: 'doc-1', _type: 'article', status: 'draft', title: 'Article 1'},
  {_id: 'doc-2', _type: 'article', status: 'review', title: 'Article 2'},
]

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

describe('R-T9: Integration — SanityDocumentTable releases prop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReleaseParam = null
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test',
      roles: [{name: 'editor', title: 'Editor'}],
    })
    mockUseQuery.mockReturnValue({data: mockData, isPending: false})
    mockUsePaginatedDocuments.mockReturnValue({
      data: mockData,
      isPending: false,
      currentPage: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      totalCount: 2,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    mockUseDocumentProjection.mockReturnValue({data: null})
    mockUseActiveReleases.mockReturnValue([asapRelease, scheduledRelease, undecidedRelease])
  })

  function renderTable(releases?: boolean, columns?: ColumnDef[], filters?: FilterDef[]) {
    return render(
      <NuqsTestingAdapter hasMemory>
        <ThemeProvider theme={theme}>
          <SanityDocumentTable
            documentType={['article']}
            columns={columns ?? [column.title(), column.type()]}
            filters={filters}
            releases={releases}
          />
        </ThemeProvider>
      </NuqsTestingAdapter>,
    )
  }

  function renderStatus(value: unknown) {
    return <span>{String(value ?? '')}</span>
  }

  it('Behavior 1 [TRACER]: SanityDocumentTable with releases=true renders the perspective pill with "Drafts" label', () => {
    renderTable(true)
    expect(screen.getByText('Drafts')).toBeInTheDocument()
  })

  it('Behavior 2: release picker trigger is present when releases enabled', () => {
    renderTable(true)
    expect(screen.getByTestId('release-picker-button')).toBeInTheDocument()
  })

  it('Behavior 3: no separate release header card is rendered above the table', () => {
    const {container} = renderTable(true)
    expect(container.querySelector('[data-testid="release-header"]')).toBeNull()
  })

  it('Behavior 4: table still renders data when releases enabled', () => {
    renderTable(true)
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    // Data rows should be present
    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.getByText('Article 2')).toBeInTheDocument()
  })

  it('Behavior 5: releases=false (default) preserves current behavior — no picker', () => {
    renderTable(false)
    expect(screen.queryByTestId('release-picker-button')).toBeNull()
    // Table still works
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('Behavior 6: releases=undefined (default) preserves current behavior', () => {
    renderTable(undefined)
    expect(screen.queryByTestId('release-picker-button')).toBeNull()
  })

  it('Behavior 6b: release picker sits directly with the server search control, not before other filters', () => {
    renderTable(true, undefined, [
      filter.string({field: 'status', label: 'Status'}),
      filter.search({fields: ['title'], label: 'Search'}),
    ])

    const pickerPill = screen.getByTestId('release-picker-pill')
    const searchInput = screen.getByPlaceholderText('Search...')
    const statusTrigger = screen.getByLabelText('Status')
    const filterSurface = screen.getByTestId('filter-surface')
    const tableSurface = screen.getByTestId('sanity-table-surface')

    const pickerGroup = pickerPill.closest('[data-ui="Flex"]')
    const searchGroup = searchInput.closest('[data-ui="Flex"]')
    const statusGroup = statusTrigger.closest('[data-ui="Flex"]')

    expect(screen.getByTestId('release-picker-button')).toBeInTheDocument()
    expect(filterSurface).toContainElement(pickerPill)
    expect(filterSurface).toContainElement(searchInput)
    expect(
      filterSurface.compareDocumentPosition(tableSurface) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(pickerGroup).toBe(searchGroup)
    expect(statusGroup).not.toBe(pickerGroup)
    expect(
      pickerPill.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('Behavior 6c: selected ASAP release applies caution tone to the full filter surface', () => {
    mockReleaseParam = 'spring'

    renderTable(true, undefined, [filter.search({fields: ['title'], label: 'Search'})])

    expect(screen.getByTestId('filter-surface')).toHaveAttribute('data-surface-tone', 'caution')
  })

  it('Behavior 6d: drafts perspective keeps the filter surface transparent', () => {
    renderTable(true, undefined, [filter.search({fields: ['title'], label: 'Search'})])

    expect(screen.getByTestId('filter-surface')).toHaveAttribute('data-surface-tone', 'default')
  })

  it('Behavior 6e: selected scheduled release applies suggest tone to the full filter surface', () => {
    mockReleaseParam = 'cyber'

    renderTable(true, undefined, [filter.search({fields: ['title'], label: 'Search'})])

    expect(screen.getByTestId('filter-surface')).toHaveAttribute('data-surface-tone', 'suggest')
  })

  it('Behavior 6f: selected undecided release keeps the filter surface transparent', () => {
    mockReleaseParam = 'ideas'

    renderTable(true, undefined, [filter.search({fields: ['title'], label: 'Search'})])

    expect(screen.getByTestId('filter-surface')).toHaveAttribute('data-surface-tone', 'transparent')
  })

  it('Behavior 6g: published perspective applies positive tone to the full filter surface', () => {
    mockReleaseParam = publishedPerspectiveParam

    renderTable(true, undefined, [filter.search({fields: ['title'], label: 'Search'})])

    expect(screen.getByTestId('filter-surface')).toHaveAttribute('data-surface-tone', 'positive')
  })

  it('Behavior 7: perspective is passed to data hook when releases enabled', () => {
    renderTable(true)
    // useQuery should have been called (query mode for array documentType)
    // When no release selected, perspective should be 'published' or undefined
    expect(mockUseQuery).toHaveBeenCalled()
  })

  it('Behavior 8: selected release uses release-as-published table perspective', () => {
    mockReleaseParam = 'spring'

    renderTable(true)

    const tableQueryCall = mockUseQuery.mock.calls
      .map(([args]) => args)
      .find(
        (args) =>
          typeof args?.query === 'string' &&
          args.query.includes('_type in $docTypes') &&
          !args.query.includes('path("versions.'),
      )

    expect(tableQueryCall).toBeDefined()
    expect(tableQueryCall?.perspective).toEqual(['spring', 'published'])
  })

  it('Behavior 9 [TRACER]: selected release does not narrow the visible row set', () => {
    mockReleaseParam = 'spring'
    mockUseQuery.mockImplementation((args?: {query?: string}) => {
      if (args?.query?.includes('path("versions.spring.*")')) {
        return {data: ['versions.spring.doc-1'], isPending: false}
      }
      return {data: mockData, isPending: false}
    })

    renderTable(true)

    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.getByText('Article 2')).toBeInTheDocument()
  })

  it('Behavior 10 [TRACER]: selected release overlays matching row content with versioned values', () => {
    mockReleaseParam = 'spring'
    mockUseQuery.mockImplementation((args?: {params?: {documentIds?: string[]}}) => {
      if (args?.params?.documentIds?.includes('versions.spring.doc-1')) {
        return {
          data: [
            {
              _id: 'versions.spring.doc-1',
              _type: 'article',
              status: 'approved',
              title: 'Article 1 (Version)',
            },
          ],
          isPending: false,
        }
      }

      return {data: mockData, isPending: false}
    })

    renderTable(true, [
      column.title(),
      {
        cell: renderStatus,
        field: 'status',
        header: 'Status',
        projection: 'coalesce(status, "draft")',
      },
    ])

    expect(screen.getByText('Article 1 (Version)')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
    expect(screen.getByText('Article 2')).toBeInTheDocument()
    expect(screen.getByText('review')).toBeInTheDocument()
  })

  it('Behavior 11: selected release falls back to normal row content when no version exists', () => {
    mockReleaseParam = 'spring'
    mockUseQuery.mockImplementation((args?: {params?: {documentIds?: string[]}}) => {
      if (args?.params?.documentIds?.includes('versions.spring.doc-1')) {
        return {data: [], isPending: false}
      }

      return {data: mockData, isPending: false}
    })

    renderTable(true, [
      column.title(),
      {
        cell: renderStatus,
        field: 'status',
        header: 'Status',
        projection: 'coalesce(status, "draft")',
      },
    ])

    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  it('Behavior 12: published perspective uses published table query perspective', () => {
    mockReleaseParam = publishedPerspectiveParam

    renderTable(true)

    const tableQueryCall = mockUseQuery.mock.calls
      .map(([args]) => args)
      .find(
        (args) =>
          typeof args?.query === 'string' &&
          args.query.includes('_type in $docTypes') &&
          !args.query.includes('path("versions.'),
      )

    expect(tableQueryCall).toBeDefined()
    expect(tableQueryCall?.perspective).toBe('published')
  })

  it('Behavior 13: published perspective does not overlay release version rows', () => {
    mockReleaseParam = publishedPerspectiveParam
    mockUseQuery.mockImplementation((args?: {params?: {documentIds?: string[]}}) => {
      if (args?.params?.documentIds?.includes('versions.spring.doc-1')) {
        return {
          data: [
            {
              _id: 'versions.spring.doc-1',
              _type: 'article',
              status: 'approved',
              title: 'Article 1 (Version)',
            },
          ],
          isPending: false,
        }
      }

      return {data: mockData, isPending: false}
    })

    renderTable(true, [
      column.title(),
      {
        cell: renderStatus,
        field: 'status',
        header: 'Status',
        projection: 'coalesce(status, "draft")',
      },
    ])

    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.queryByText('Article 1 (Version)')).toBeNull()
  })

  it('Behavior 14: published perspective strips inline cell edit affordances', () => {
    mockReleaseParam = publishedPerspectiveParam

    renderTable(true, [
      column.title(),
      {
        field: 'status',
        header: 'Status',
        id: 'status',
        edit: {
          mode: 'select',
          onSave: vi.fn(),
          options: [
            {label: 'Draft', value: 'draft'},
            {label: 'Review', value: 'review'},
          ],
        },
      },
    ])

    const table = screen.getByRole('table')
    const statusCellValue = within(table).getByText('draft')

    expect(statusCellValue.closest('button')).toBeNull()
  })
})
