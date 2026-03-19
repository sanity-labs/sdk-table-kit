import {describe, it, expect, vi, beforeEach} from 'vitest'
import {renderHook, act} from '@testing-library/react'
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
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

// Mock internal dependencies
const mockToastPush = vi.fn()
vi.mock('../src/ReleaseContext', () => ({
  useOptionalReleaseContext: () => null,
}))
vi.mock('../src/useSafeToast', () => ({
  useSafeToast: () => ({push: mockToastPush}),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCreateDocument — error handling', () => {
  it('Behavior 1: shows error toast on creation failure', async () => {
    mockApply.mockRejectedValueOnce(new Error('Network error'))
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    await expect(
      act(async () => {
        await result.current.create()
      }),
    ).rejects.toThrow('Network error')
    expect(mockToastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        title: expect.stringContaining('create document'),
      }),
    )
  })

  it('Behavior 2: isCreating resets to false after error', async () => {
    mockApply.mockRejectedValueOnce(new Error('Server error'))
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    try {
      await act(async () => {
        await result.current.create()
      })
    } catch {
      // expected
    }
    expect(result.current.isCreating).toBe(false)
  })

  it('Behavior 3: can create again after error recovery', async () => {
    mockApply.mockRejectedValueOnce(new Error('Temporary error'))
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    try {
      await act(async () => {
        await result.current.create()
      })
    } catch {
      // expected
    }
    // Second attempt should work
    mockApply.mockResolvedValueOnce(undefined)
    await act(async () => {
      await result.current.create()
    })
    expect(mockApply).toHaveBeenCalledTimes(2)
    // After successful creation, isCreating stays true (deferred reset — consumer calls resetCreating)
    expect(result.current.isCreating).toBe(true)
  })

  it('Behavior 4: toast has closable and duration properties', async () => {
    mockApply.mockRejectedValueOnce(new Error('Fail'))
    const {result} = renderHook(() => useCreateDocument({documentType: 'article'}))
    try {
      await act(async () => {
        await result.current.create()
      })
    } catch {
      // expected
    }
    expect(mockToastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        closable: true,
        duration: 5000,
      }),
    )
  })
})
