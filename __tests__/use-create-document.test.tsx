import {renderHook, act} from '@testing-library/react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {useCreateDocument} from '../src/useCreateDocument'

// Mock SDK
const mockApply = vi.fn().mockResolvedValue(undefined)
vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => mockApply,
  useCurrentUser: () => ({
    id: 'user-1',
    name: 'Test',
    roles: [{name: 'administrator', title: 'Administrator'}],
  }),
}))
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn((handle: unknown, initialValue?: unknown) => ({
    type: 'createDocument',
    handle,
    initialValue,
  })),
}))

// Mock internal dependencies
vi.mock('../src/ReleaseContext', () => ({
  useOptionalReleaseContext: () => null,
}))
const mockToastPush = vi.fn()
vi.mock('../src/useSafeToast', () => ({
  useSafeToast: () => ({push: mockToastPush}),
}))

import {createDocument} from '@sanity/sdk'

beforeEach(() => {
  vi.clearAllMocks()
  mockApply.mockResolvedValue(undefined)
})

describe('useCreateDocument', () => {
  it('Behavior 1: returns create function and isCreating=false initially', () => {
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    expect(result.current.create).toBeInstanceOf(Function)
    expect(result.current.isCreating).toBe(false)
  })

  it('Behavior 2: create() calls createDocument with documentType and applies action', async () => {
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    await act(async () => {
      await result.current.create()
    })
    expect(createDocument).toHaveBeenCalledWith({documentType: 'article'}, undefined)
    expect(mockApply).toHaveBeenCalledTimes(1)
  })

  it('Behavior 3: isCreating is true during creation and stays true after resolve (deferred reset)', async () => {
    let resolveApply: () => void
    mockApply.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveApply = resolve
        }),
    )

    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))

    act(() => {
      result.current.create()
    })

    expect(result.current.isCreating).toBe(true)

    await act(async () => {
      resolveApply!()
    })

    // After successful creation, isCreating stays true (deferred reset)
    expect(result.current.isCreating).toBe(true)
  })

  it('Behavior 4: create() merges initialValues into createDocument call', async () => {
    const {result} = renderHook(() =>
      useCreateDocument({
        documentType: 'article',
        initialValues: {status: 'draft', priority: 'high'},
      }),
    )
    await act(async () => {
      await result.current.create()
    })
    expect(createDocument).toHaveBeenCalledWith(
      {documentType: 'article'},
      {status: 'draft', priority: 'high'},
    )
  })

  it('Behavior 5: create() merges activeFilters over initialValues (filters take precedence)', async () => {
    const {result} = renderHook(() =>
      useCreateDocument({
        documentType: 'article',
        initialValues: {status: 'draft', section: 'news'},
        activeFilters: {status: 'in_progress'},
      }),
    )
    await act(async () => {
      await result.current.create()
    })
    expect(createDocument).toHaveBeenCalledWith(
      {documentType: 'article'},
      {status: 'in_progress', section: 'news'},
    )
  })

  it('Behavior 6: isCreating stays true after successful creation (deferred reset)', async () => {
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    await act(async () => {
      await result.current.create()
    })
    // After successful creation, isCreating stays true until resetCreating() is called
    expect(result.current.isCreating).toBe(true)
  })

  it('Behavior 7: error shows toast and resets isCreating', async () => {
    mockApply.mockRejectedValueOnce(new Error('Network error'))
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    await expect(
      act(async () => {
        await result.current.create()
      }),
    ).rejects.toThrow('Network error')
    expect(result.current.isCreating).toBe(false)
    expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({status: 'error'}))
  })

  it('Behavior 8: rapid double-click only creates one document (debounce)', async () => {
    let resolveApply: () => void
    mockApply.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveApply = resolve
        }),
    )

    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))

    // Fire two creates rapidly
    act(() => {
      result.current.create()
      result.current.create() // should be no-op
    })

    expect(mockApply).toHaveBeenCalledTimes(1)

    // Resolve the pending creation
    await act(async () => {
      resolveApply!()
    })
  })

  it('Behavior 9: resetCreating() resets isCreating to false', async () => {
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))

    await act(async () => {
      await result.current.create()
    })

    // isCreating should still be true after successful creation
    expect(result.current.isCreating).toBe(true)

    // Call resetCreating to reset
    act(() => {
      result.current.resetCreating()
    })

    expect(result.current.isCreating).toBe(false)
  })

  it('Behavior 10: can create again after resetCreating()', async () => {
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))

    // First creation
    await act(async () => {
      await result.current.create()
    })
    expect(result.current.isCreating).toBe(true)

    // Reset
    act(() => {
      result.current.resetCreating()
    })
    expect(result.current.isCreating).toBe(false)

    // Second creation should work (not blocked by debounce)
    mockApply.mockResolvedValueOnce(undefined)
    await act(async () => {
      await result.current.create()
    })
    expect(mockApply).toHaveBeenCalledTimes(2)
    expect(result.current.isCreating).toBe(true)
  })

  it('Behavior 11: safety timeout resets isCreating after 10s', async () => {
    vi.useFakeTimers()

    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))

    await act(async () => {
      await result.current.create()
    })

    expect(result.current.isCreating).toBe(true)

    // Advance time by 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(result.current.isCreating).toBe(false)

    vi.useRealTimers()
  })

  it('Behavior 12: resetCreating() clears safety timeout (no double-reset)', async () => {
    vi.useFakeTimers()

    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))

    await act(async () => {
      await result.current.create()
    })

    expect(result.current.isCreating).toBe(true)

    // Reset immediately
    act(() => {
      result.current.resetCreating()
    })
    expect(result.current.isCreating).toBe(false)

    // Advance past safety timeout — should not cause issues
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    // Still false — no double-reset
    expect(result.current.isCreating).toBe(false)

    vi.useRealTimers()
  })
})
