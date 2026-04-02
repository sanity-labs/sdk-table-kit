import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {render} from '@testing-library/react'
import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import React from 'react'
import {describe, it, expect, vi, beforeEach, beforeAll} from 'vitest'

import {DocumentStatusCell} from '../src/components/status/DocumentStatusCell'

const mockUseQuery = vi.fn()
let mockActiveReleases: Array<{
  name: string
  metadata: {title: string; releaseType: string}
  _id: string
  _type: string
  _createdAt: string
  _updatedAt: string
  _rev: string
  state: string
}> = []

vi.mock('@sanity/sdk-react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useActiveReleases: () => mockActiveReleases,
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

const mockReleaseContext = {
  activeReleases: [] as Array<{
    name: string
    metadata: {title: string; releaseType: string}
    _id: string
    _type: string
    _createdAt: string
    _updatedAt: string
    _rev: string
    state: string
  }>,
  selectedRelease: null,
  selectedReleaseId: null,
  setSelectedReleaseId: vi.fn(),
  getQueryPerspective: () => 'published' as const,
  createRelease: vi.fn(),
  addToRelease: vi.fn(),
}

vi.mock('../src/context/ReleaseContext', () => ({
  useReleaseContext: () => mockReleaseContext,
  useOptionalReleaseContext: () => mockReleaseContext,
}))

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

const theme = buildTheme()
function renderWithTheme(ui: React.ReactElement) {
  return render(
    <NuqsTestingAdapter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </NuqsTestingAdapter>,
  )
}

const asapRelease = {
  _id: '_.releases.spring',
  _type: 'system.release',
  name: 'spring',
  state: 'active',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'r1',
  metadata: {title: 'Spring Campaign', releaseType: 'asap' as const},
}
const scheduledRelease = {
  _id: '_.releases.cyber',
  _type: 'system.release',
  name: 'cyber',
  state: 'active',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'r2',
  metadata: {title: 'Cyber Monday', releaseType: 'scheduled' as const},
}
const undecidedRelease = {
  _id: '_.releases.untitled',
  _type: 'system.release',
  name: 'untitled',
  state: 'active',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-03-01T00:00:00Z',
  _rev: 'r3',
  metadata: {title: 'Untitled', releaseType: 'undecided' as const},
}

describe('R-T7: Enhanced DocumentStatusCell — sanity::versionOf + overlapping dots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveReleases = []
    mockUseQuery.mockReturnValue({data: [], isPending: false})
  })

  it('Behavior 1 [TRACER]: renders green dot when only published exists', () => {
    mockUseQuery.mockReturnValue({
      data: [{_id: 'doc-1', _updatedAt: '2026-01-01'}],
      isPending: false,
    })
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(1)
  })

  it('Behavior 2: renders orange dot when only draft exists', () => {
    mockUseQuery.mockReturnValue({
      data: [{_id: 'drafts.doc-1', _updatedAt: '2026-01-01'}],
      isPending: false,
    })
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(1)
  })

  it('Behavior 3: renders release dot when version exists and release is active', () => {
    mockActiveReleases = [asapRelease]
    mockUseQuery.mockReturnValue({
      data: [{_id: 'versions.spring.doc-1', _updatedAt: '2026-03-01'}],
      isPending: false,
    })
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(1)
  })

  it('Behavior 4: shows all dots when published + draft + releases exist', () => {
    mockActiveReleases = [asapRelease, scheduledRelease]
    mockUseQuery.mockReturnValue({
      data: [
        {_id: 'doc-1', _updatedAt: '2026-01-01'},
        {_id: 'drafts.doc-1', _updatedAt: '2026-01-02'},
        {_id: 'versions.spring.doc-1', _updatedAt: '2026-03-01'},
        {_id: 'versions.cyber.doc-1', _updatedAt: '2026-03-02'},
      ],
      isPending: false,
    })
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(4)
  })

  it('Behavior 5: only shows dots for versions that actually exist', () => {
    mockActiveReleases = [asapRelease, scheduledRelease, undecidedRelease]
    mockUseQuery.mockReturnValue({
      data: [
        {_id: 'doc-1', _updatedAt: '2026-01-01'},
        {_id: 'versions.spring.doc-1', _updatedAt: '2026-03-01'},
      ],
      isPending: false,
    })
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(2) // published + spring only
  })

  it('Behavior 6: shows muted dot when no versions exist', () => {
    mockUseQuery.mockReturnValue({data: [], isPending: false})
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(1) // muted "New"
  })

  it('Behavior 7: dots overlap with negative margin', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {_id: 'doc-1', _updatedAt: '2026-01-01'},
        {_id: 'drafts.doc-1', _updatedAt: '2026-01-02'},
      ],
      isPending: false,
    })
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    expect(dots.length).toBe(2)
    // Second dot should have negative margin
    expect((dots[1] as HTMLElement).style.marginLeft).toBe('-3px')
    // First dot should have no margin
    expect((dots[0] as HTMLElement).style.marginLeft).toBe('0px')
  })

  it('Behavior 8: uses sanity::versionOf in query', () => {
    mockUseQuery.mockReturnValue({data: [], isPending: false})
    renderWithTheme(<DocumentStatusCell documentId="doc-1" documentType="article" />)
    const queryCall = mockUseQuery.mock.calls[0]?.[0]
    expect(queryCall.query).toContain('sanity::versionOf')
    expect(queryCall.params.publishedId).toBe('doc-1')
  })

  it('Behavior 9: strips drafts. prefix from documentId', () => {
    mockUseQuery.mockReturnValue({data: [], isPending: false})
    renderWithTheme(<DocumentStatusCell documentId="drafts.doc-1" documentType="article" />)
    const queryCall = mockUseQuery.mock.calls[0]?.[0]
    expect(queryCall.params.publishedId).toBe('doc-1')
  })

  it('Behavior 10: dots have white border for overlap visibility', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {_id: 'doc-1', _updatedAt: '2026-01-01'},
        {_id: 'drafts.doc-1', _updatedAt: '2026-01-02'},
      ],
      isPending: false,
    })
    const {container} = renderWithTheme(
      <DocumentStatusCell documentId="doc-1" documentType="article" />,
    )
    const dots = container.querySelectorAll('[data-testid="status-dot"]')
    const style = (dots[0] as HTMLElement).style
    expect(style.border).toContain('1.5px solid')
  })
})
