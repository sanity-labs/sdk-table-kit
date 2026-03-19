import {describe, it, expect, vi, beforeEach} from 'vitest'
import type {ColumnDef} from '@sanetti/sanity-table-kit'
import {column} from '@sanetti/sanity-table-kit'

// Mock useCurrentUser from SDK
const mockCurrentUser = vi.fn()
vi.mock('@sanity/sdk-react', () => ({
  useCurrentUser: () => mockCurrentUser(),
  useApplyDocumentActions: () => vi.fn().mockResolvedValue({}),
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  editDocument: vi.fn(),
}))

import {useRoleFilteredColumns} from '../src/useRoleFilteredColumns'
import {renderHook} from '@testing-library/react'

describe('useRoleFilteredColumns — role-based visibility + editability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('Behavior 1 [TRACER]: column without visibleTo/editableBy passes through unchanged', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test User',
      roles: [{name: 'editor', title: 'Editor'}],
    })

    const cols = [column.title(), column.type()] as ColumnDef[]

    const {result} = renderHook(() => useRoleFilteredColumns(cols))
    expect(result.current).toHaveLength(2)
    expect(result.current[0].id).toBe('title')
    expect(result.current[1].id).toBe('type')
  })

  it('Behavior 2: column with visibleTo matching user role is included', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test User',
      roles: [{name: 'editor', title: 'Editor'}],
    })

    const cols = [
      column.title(),
      {
        ...column.badge({field: 'status', colorMap: {draft: 'caution'}}),
        visibleTo: ['editor', 'administrator'],
      },
    ] as ColumnDef[]

    const {result} = renderHook(() => useRoleFilteredColumns(cols))
    expect(result.current).toHaveLength(2)
  })

  it('Behavior 3: column with visibleTo NOT matching user role is excluded', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test User',
      roles: [{name: 'viewer', title: 'Viewer'}],
    })

    const cols = [
      column.title(),
      {
        ...column.badge({field: 'status', colorMap: {draft: 'caution'}}),
        visibleTo: ['editor', 'administrator'],
      },
    ] as ColumnDef[]

    const {result} = renderHook(() => useRoleFilteredColumns(cols))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('title')
  })

  it('Behavior 4: column with editableBy matching user role keeps edit config', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test User',
      roles: [{name: 'editor', title: 'Editor'}],
    })

    const cols = [
      {
        ...column.badge({field: 'status', colorMap: {draft: 'caution'}, edit: true}),
        editableBy: ['editor'],
      },
    ] as ColumnDef[]

    const {result} = renderHook(() => useRoleFilteredColumns(cols))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].edit).toBeDefined()
  })

  it('Behavior 5: column with editableBy NOT matching user role has edit stripped', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test User',
      roles: [{name: 'viewer', title: 'Viewer'}],
    })

    const cols = [
      {
        ...column.badge({field: 'status', colorMap: {draft: 'caution'}, edit: true}),
        editableBy: ['editor', 'administrator'],
      },
    ] as ColumnDef[]

    const {result} = renderHook(() => useRoleFilteredColumns(cols))
    expect(result.current).toHaveLength(1)
    // Column is still visible but edit is stripped
    expect(result.current[0].edit).toBeUndefined()
  })

  it('Behavior 6: visibleTo + editableBy together — visible but read-only', () => {
    mockCurrentUser.mockReturnValue({
      id: 'user1',
      name: 'Test User',
      roles: [{name: 'editor', title: 'Editor'}],
    })

    const cols = [
      {
        ...column.badge({field: 'status', colorMap: {draft: 'caution'}, edit: true}),
        visibleTo: ['editor', 'administrator'],
        editableBy: ['administrator'],
      },
    ] as ColumnDef[]

    const {result} = renderHook(() => useRoleFilteredColumns(cols))
    // Editor can see the column
    expect(result.current).toHaveLength(1)
    // But cannot edit (only administrators can)
    expect(result.current[0].edit).toBeUndefined()
  })

  it('Behavior 7: null currentUser with visibleTo/editableBy logs console.warn', () => {
    mockCurrentUser.mockReturnValue(null)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const cols = [
      column.title(),
      {...column.badge({field: 'status', colorMap: {draft: 'caution'}}), visibleTo: ['editor']},
    ] as ColumnDef[]

    const {result} = renderHook(() => useRoleFilteredColumns(cols))
    // Should show all columns (graceful degradation)
    expect(result.current).toHaveLength(2)
    // Should warn
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('visibleTo'))
  })
})
