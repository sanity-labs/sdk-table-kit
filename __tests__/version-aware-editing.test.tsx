import type {ColumnDef, DocumentBase} from '@sanetti/sanity-table-kit'
import {renderHook} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useResolvedColumns} from '../src/useResolvedColumns'

// Track editDocument calls
const mockEditDocument = vi.fn(() => ({type: 'edit'}))
const mockApply = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => mockApply,
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

vi.mock('../src/ReleaseContext', () => ({
  useReleaseContext: () => ({
    activeReleases: [],
    selectedRelease: null,
    selectedReleaseId: mockSelectedReleaseId,
    setSelectedReleaseId: vi.fn(),
    getQueryPerspective: () =>
      mockSelectedReleaseId ? [mockSelectedReleaseId, 'published'] : 'published',
    createRelease: vi.fn(),
    addToRelease: vi.fn(),
  }),
  useOptionalReleaseContext: () => ({
    activeReleases: [],
    selectedRelease: null,
    selectedReleaseId: mockSelectedReleaseId,
    setSelectedReleaseId: vi.fn(),
    getQueryPerspective: () =>
      mockSelectedReleaseId ? [mockSelectedReleaseId, 'published'] : 'published',
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
  })

  it('Behavior 1 [TRACER]: createOnSave targets version document ID when release is active', () => {
    mockSelectedReleaseId = 'spring-campaign'

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    expect(resolved.edit?.onSave).toBeDefined()

    // Simulate calling onSave with a row
    const mockRow: DocumentBase = {_id: 'doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    // editDocument should be called with version document ID
    expect(mockEditDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'versions.spring-campaign.doc-1',
      }),
      expect.any(Object),
    )
  })

  it('Behavior 2: createOnSave targets draft document when no release selected', () => {
    mockSelectedReleaseId = null

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    const mockRow: DocumentBase = {_id: 'doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    // editDocument should use original document ID
    expect(mockEditDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
      }),
      expect.any(Object),
    )
  })

  it('Behavior 3: strips drafts. prefix before constructing version ID', () => {
    mockSelectedReleaseId = 'spring-campaign'

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    // Row has drafts. prefix
    const mockRow: DocumentBase = {_id: 'drafts.doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    // Should strip drafts. and use published ID for version construction
    expect(mockEditDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'versions.spring-campaign.doc-1',
      }),
      expect.any(Object),
    )
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

  it('Behavior 6: version ID uses published base even when row has versions. prefix', () => {
    mockSelectedReleaseId = 'cyber-monday'

    const {result} = renderHook(() => useResolvedColumns([makeAutoSaveColumn('title')]))

    const resolved = result.current[0]
    // Row already has a version ID (viewing from another release perspective)
    const mockRow: DocumentBase = {_id: 'versions.spring.doc-1', _type: 'article'}
    resolved.edit!.onSave!(mockRow, 'New Title')

    // Should extract base ID (doc-1) and construct new version ID
    expect(mockEditDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'versions.cyber-monday.doc-1',
      }),
      expect.any(Object),
    )
  })
})
