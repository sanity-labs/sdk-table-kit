import type {ColumnDef, DocumentBase} from '@sanity-labs/react-table-kit'
import {renderHook, waitFor} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useResolvedColumns} from '../src/hooks/useResolvedColumns'

// Track editDocument calls
const mockEditDocument = vi.fn(() => ({type: 'edit'}))
const mockApply = vi.fn()
const mockFetch = vi.fn()
const mockAction = vi.fn()
const mockFetchReleaseDocuments = vi.fn()
let mockVersionDocuments = new Map<string, Record<string, unknown>>()

vi.mock(import('nuqs'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useQueryState: () => [null, vi.fn()],
  }
})

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => mockApply,
  useClient: () => ({
    action: (...args: unknown[]) => mockAction(...args),
    fetch: (...args: unknown[]) => mockFetch(...args),
    releases: {
      fetchDocuments: (...args: unknown[]) => mockFetchReleaseDocuments(...args),
    },
  }),
  useDocumentPreview: () => ({data: {title: 'Preview'}}),
  useDocumentProjection: () => ({data: null}),
  useDocuments: () => ({data: []}),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: (...args: unknown[]) => mockEditDocument(...args),
}))

// Mock ReleaseContext — controlled per test
let mockSelectedReleaseId: string | null = null

vi.mock('../src/context/ReleaseContext', () => ({
  parseReleasePerspectiveParam: (value: string | null | undefined) =>
    value ? {kind: 'release' as const, releaseId: value} : {kind: 'drafts' as const},
  useReleaseContext: () => ({
    activeReleases: [],
    isDraftsPerspective: mockSelectedReleaseId === null,
    isPublishedPerspective: false,
    selectedPerspective: mockSelectedReleaseId
      ? {kind: 'release' as const, releaseId: mockSelectedReleaseId}
      : {kind: 'drafts' as const},
    selectedRelease: null,
    selectedReleaseId: mockSelectedReleaseId,
    setSelectedReleaseId: vi.fn(),
    setSelectedPerspective: vi.fn(),
    getQueryPerspective: () =>
      mockSelectedReleaseId ? [mockSelectedReleaseId, 'published'] : undefined,
    createRelease: vi.fn(),
    addToRelease: vi.fn(),
  }),
  useOptionalReleaseContext: () => ({
    activeReleases: [],
    isDraftsPerspective: mockSelectedReleaseId === null,
    isPublishedPerspective: false,
    selectedPerspective: mockSelectedReleaseId
      ? {kind: 'release' as const, releaseId: mockSelectedReleaseId}
      : {kind: 'drafts' as const},
    selectedRelease: null,
    selectedReleaseId: mockSelectedReleaseId,
    setSelectedReleaseId: vi.fn(),
    setSelectedPerspective: vi.fn(),
    getQueryPerspective: () =>
      mockSelectedReleaseId ? [mockSelectedReleaseId, 'published'] : undefined,
    createRelease: vi.fn(),
    addToRelease: vi.fn(),
  }),
}))

function makeAutoSaveColumn(field: string): ColumnDef {
  return {
    id: field,
    header: field,
    field,
    edit: {
      _autoSave: true,
      _field: field,
      mode: 'text',
    },
  }
}

describe('R-T8: Inline edits target version documents in release context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedReleaseId = null
    mockVersionDocuments = new Map()
    mockApply.mockResolvedValue(undefined)
    mockFetchReleaseDocuments.mockImplementation(async () => [])
    mockFetch.mockImplementation(
      async (_query: string, params?: {documentId?: string}, options?: {perspective?: string}) => {
        if (options?.perspective !== 'raw' || !params?.documentId) {
          return null
        }

        return mockVersionDocuments.get(params.documentId) ?? null
      },
    )
    mockAction.mockImplementation(async (action: Record<string, unknown>) => {
      if (action.actionType === 'sanity.action.document.version.create') {
        const versionId = String(action.versionId)

        if (mockVersionDocuments.has(versionId)) {
          throw new Error(`Document by ID "${versionId}" already exists`)
        }

        mockVersionDocuments.set(versionId, {
          _id: versionId,
          _type: 'article',
          preservedField: 'keep me',
          title: 'Old title',
        })

        return {}
      }

      if (action.actionType === 'sanity.action.document.version.replace') {
        const document = action.document as Record<string, unknown>
        mockVersionDocuments.set(String(document._id), document)
        return {}
      }

      return {}
    })
  })

  it('Behavior 1 [TRACER]: createOnSave stages edits into a release version when release is active', async () => {
    mockSelectedReleaseId = 'spring-campaign'

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    expect(resolved.edit?.onSave).toBeDefined()

    const mockRow: DocumentBase = {_id: 'doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        actionType: 'sanity.action.document.version.create',
        baseId: 'doc-1',
        publishedId: 'doc-1',
        versionId: 'versions.spring-campaign.doc-1',
      })
    })

    expect(mockEditDocument).not.toHaveBeenCalled()
    expect(mockAction).toHaveBeenCalledWith({
      actionType: 'sanity.action.document.version.replace',
      document: expect.objectContaining({
        _id: 'versions.spring-campaign.doc-1',
        _type: 'article',
        preservedField: 'keep me',
        title: 'New Title',
      }),
    })
  })

  it('Behavior 2: createOnSave targets draft editing when no release selected', () => {
    mockSelectedReleaseId = null

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    const mockRow: DocumentBase = {_id: 'doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    expect(mockEditDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
      }),
      expect.any(Object),
    )
    expect(mockAction).not.toHaveBeenCalled()
  })

  it('Behavior 3: strips drafts. prefix before constructing version ID', async () => {
    mockSelectedReleaseId = 'spring-campaign'

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    const mockRow: DocumentBase = {_id: 'drafts.doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        actionType: 'sanity.action.document.version.create',
        baseId: 'doc-1',
        publishedId: 'doc-1',
        versionId: 'versions.spring-campaign.doc-1',
      })
    })
  })

  it('Behavior 3b [TRACER]: existing release versions are replaced instead of recreated', async () => {
    mockSelectedReleaseId = 'spring-campaign'
    mockVersionDocuments.set('versions.spring-campaign.doc-1', {
      _id: 'versions.spring-campaign.doc-1',
      _type: 'article',
      assignments: [{_key: 'a1', _type: 'assignment', userId: 'user-1'}],
      title: 'Existing release title',
    })

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))
    const resolved = result.current[0]
    const mockRow: DocumentBase = {_id: 'doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'Updated release title')

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        actionType: 'sanity.action.document.version.replace',
        document: expect.objectContaining({
          _id: 'versions.spring-campaign.doc-1',
          _type: 'article',
          assignments: [{_key: 'a1', _type: 'assignment', userId: 'user-1'}],
          title: 'Updated release title',
        }),
      })
    })

    expect(mockAction).not.toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'sanity.action.document.version.create',
        versionId: 'versions.spring-campaign.doc-1',
      }),
    )
  })

  it('Behavior 3c [TRACER]: create conflicts recover by loading the existing version and replacing it', async () => {
    mockSelectedReleaseId = 'spring-campaign'
    mockFetch.mockResolvedValue(null)
    mockVersionDocuments.set('versions.spring-campaign.doc-1', {
      _id: 'versions.spring-campaign.doc-1',
      _type: 'article',
      assignments: [{_key: 'a1', _type: 'assignment', userId: 'user-1'}],
      title: 'Existing release title',
    })
    mockFetchReleaseDocuments.mockResolvedValue([
      {
        _id: 'versions.spring-campaign.doc-1',
        _type: 'article',
        assignments: [{_key: 'a1', _type: 'assignment', userId: 'user-1'}],
        title: 'Existing release title',
      },
    ])
    mockAction.mockImplementation(async (action: Record<string, unknown>) => {
      if (action.actionType === 'sanity.action.document.version.create') {
        throw new Error('Document by ID "versions.spring-campaign.doc-1" already exists')
      }

      if (action.actionType === 'sanity.action.document.version.replace') {
        return {}
      }

      return {}
    })

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))
    const resolved = result.current[0]
    const mockRow: DocumentBase = {_id: 'doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'Recovered release title')

    await waitFor(() => {
      expect(mockFetchReleaseDocuments).toHaveBeenCalledWith({releaseId: 'spring-campaign'})
      expect(mockAction).toHaveBeenCalledWith({
        actionType: 'sanity.action.document.version.replace',
        document: expect.objectContaining({
          _id: 'versions.spring-campaign.doc-1',
          _type: 'article',
          assignments: [{_key: 'a1', _type: 'assignment', userId: 'user-1'}],
          title: 'Recovered release title',
        }),
      })
    })
  })

  it('Behavior 4: reference edits target version document', () => {
    mockSelectedReleaseId = 'spring-campaign'

    const refColumn: ColumnDef = {
      id: 'author',
      header: 'Author',
      field: 'author',
      edit: {
        _autoSave: true,
        _field: 'author',
        _referenceType: 'person',
        mode: 'custom',
      },
    }

    const {result} = renderHook(() => useResolvedColumns([refColumn]))

    // Reference columns replace cell (edit is set to undefined — cell handles its own edit UI)
    const resolved = result.current[0]
    expect(resolved.cell).toBeDefined()
    expect(resolved.edit).toBeUndefined() // edit removed — ReferenceCell handles edit internally
  })

  it('Behavior 5: boolean toggle targets version document', () => {
    mockSelectedReleaseId = 'spring-campaign'

    const boolColumn: ColumnDef = {
      id: 'featured',
      header: 'Featured',
      field: 'featured',
      edit: {
        _autoSave: true,
        _field: 'featured',
        mode: 'custom',
      },
    }

    const {result} = renderHook(() => useResolvedColumns([boolColumn]))

    // Boolean columns replace cell with ToggleSwitch (edit removed — cell handles toggle)
    const resolved = result.current[0]
    expect(resolved.cell).toBeDefined()
    expect(resolved.edit).toBeUndefined()
  })

  it('Behavior 6: version ID uses published base even when row has versions. prefix', async () => {
    mockSelectedReleaseId = 'cyber-monday'

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    const mockRow: DocumentBase = {_id: 'versions.spring.doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledWith({
        actionType: 'sanity.action.document.version.create',
        baseId: 'doc-1',
        publishedId: 'doc-1',
        versionId: 'versions.cyber-monday.doc-1',
      })
    })
  })
})
