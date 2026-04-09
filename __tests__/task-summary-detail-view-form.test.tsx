import {act, fireEvent, screen, waitFor} from '@testing-library/react'
import React from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {TaskSummaryDetailView} from '../src/components/tasks/TaskSummaryDetailView'
import {toPlainText} from '../src/helpers/comments/addonCommentUtils'
import {renderWithTheme} from './helpers'

const {mockEditTask, mockRemoveTask, mockToggleTaskStatus} = vi.hoisted(() => ({
  mockEditTask: vi.fn(),
  mockRemoveTask: vi.fn(),
  mockToggleTaskStatus: vi.fn(),
}))

vi.mock('../src/context/AddonDataContext', () => ({
  useAddonData: () => ({
    workspaceId: 'workspace-news',
    workspaceTitle: 'News workspace',
  }),
}))

vi.mock('../src/hooks/useAddonTaskMutations', () => ({
  useAddonTaskMutations: () => ({
    editTask: mockEditTask,
    removeTask: mockRemoveTask,
    toggleTaskStatus: mockToggleTaskStatus,
  }),
}))

vi.mock('../src/hooks/useCurrentResourceUserId', () => ({
  useCurrentResourceUserId: () => 'resource-user-1',
}))

vi.mock('../src/hooks/useTaskComments', () => ({
  useTaskComments: () => ({comments: []}),
}))

vi.mock('../src/hooks/useTaskCommentMutations', () => ({
  useTaskCommentMutations: () => ({
    createComment: vi.fn(),
  }),
}))

vi.mock('../src/components/comments/SharedCommentsPanel', () => ({
  SharedCommentsPanel: () => <div data-testid="task-comments-panel" />,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
})

describe('TaskSummaryDetailView realtime autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockEditTask.mockResolvedValue({})
    mockRemoveTask.mockResolvedValue({})
    mockToggleTaskStatus.mockResolvedValue({})
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('debounces title and description autosaves while typing', async () => {
    renderWithTheme(
      <TaskSummaryDetailView
        onBack={() => {}}
        task={
          {
            _createdAt: '2026-04-01T00:00:00.000Z',
            _id: 'task-1',
            _type: 'tasks.task',
            _updatedAt: '2026-04-01T00:00:00.000Z',
            authorId: 'resource-user-1',
            description: undefined,
            status: 'open',
            title: 'Original title',
          } as never
        }
        users={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Task title...'), {
      target: {value: 'Updated task title'},
    })
    fireEvent.change(screen.getByPlaceholderText('Add a description...'), {
      target: {value: 'Line one\nLine two'},
    })

    expect(mockEditTask).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    await waitFor(() => {
      expect(mockEditTask).toHaveBeenCalledTimes(2)
    })

    const titleCall = mockEditTask.mock.calls.find(
      (call) => typeof call[1] === 'object' && call[1] !== null && 'title' in call[1],
    ) as [string, Record<string, unknown>] | undefined
    expect(titleCall?.[0]).toBe('task-1')
    expect(titleCall?.[1]).toEqual({title: 'Updated task title'})

    const descriptionCall = mockEditTask.mock.calls.find(
      (call) => typeof call[1] === 'object' && call[1] !== null && 'description' in call[1],
    ) as [string, Record<string, unknown>] | undefined
    expect(descriptionCall?.[0]).toBe('task-1')
    expect(toPlainText(descriptionCall?.[1].description as never)).toBe('Line one\nLine two')
  })

  it('flushes pending debounced writes through registered flush callback', async () => {
    let flushPendingWrites: null | (() => Promise<boolean>) = null

    renderWithTheme(
      <TaskSummaryDetailView
        onBack={() => {}}
        onRegisterFlushPending={(flushFn) => {
          flushPendingWrites = flushFn
        }}
        task={
          {
            _createdAt: '2026-04-01T00:00:00.000Z',
            _id: 'task-1',
            _type: 'tasks.task',
            _updatedAt: '2026-04-01T00:00:00.000Z',
            authorId: 'resource-user-1',
            description: undefined,
            status: 'open',
            title: 'Original title',
          } as never
        }
        users={[]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Task title...'), {
      target: {value: 'Changed title'},
    })

    expect(mockEditTask).not.toHaveBeenCalled()

    await act(async () => {
      const didFlush = await flushPendingWrites?.()
      expect(didFlush).toBe(true)
    })

    await waitFor(() => {
      expect(mockEditTask).toHaveBeenCalledWith('task-1', {title: 'Changed title'})
    })
  })

  it('saves assignee updates immediately (no debounce)', async () => {
    renderWithTheme(
      <TaskSummaryDetailView
        onBack={() => {}}
        task={
          {
            _createdAt: '2026-04-01T00:00:00.000Z',
            _id: 'task-1',
            _type: 'tasks.task',
            _updatedAt: '2026-04-01T00:00:00.000Z',
            authorId: 'resource-user-1',
            description: undefined,
            status: 'open',
            title: 'Original title',
          } as never
        }
        users={
          [
            {
              memberships: [{resourceUserId: 'resource-user-2'}],
              profile: {displayName: 'Sam Hemingway', email: 'sam@example.com'},
              sanityUserId: 'sanity-user-2',
            },
          ] as never
        }
      />,
    )

    fireEvent.click(screen.getByText('Unassigned'))
    fireEvent.click(screen.getByText('Sam Hemingway'))

    await waitFor(() => {
      expect(mockEditTask).toHaveBeenCalledWith('task-1', {assignedTo: 'resource-user-2'})
    })
  })
})
