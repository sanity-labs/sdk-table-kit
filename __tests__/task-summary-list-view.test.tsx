import {fireEvent, screen} from '@testing-library/react'
import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {TaskSummaryListView} from '../src/components/tasks/TaskSummaryListView'
import {buildMessageFromPlainText} from '../src/helpers/comments/addonCommentUtils'
import {renderWithTheme} from './helpers'

const {mockUseTaskComments} = vi.hoisted(() => ({
  mockUseTaskComments: vi.fn(),
}))

vi.mock('../src/hooks/useTaskComments', () => ({
  useTaskComments: mockUseTaskComments,
}))

describe('TaskSummaryListView filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTaskComments.mockReturnValue({comments: []})
  })

  it('renders all filter badges and disables zero-count filters', () => {
    renderWithTheme(
      <TaskSummaryListView
        activeFilter="todo"
        doneCount={1}
        onFilterChange={() => {}}
        onSelectTask={() => {}}
        overdueCount={2}
        tasks={[]}
        todoCount={3}
        unassignedCount={0}
        users={[]}
      />,
    )

    expect(screen.getByRole('button', {name: '3 Todo'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '2 Overdue'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '1 Done'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '0 Unassigned'})).toBeDisabled()
  })

  it('calls onFilterChange only for non-zero badges', () => {
    const onFilterChange = vi.fn()

    renderWithTheme(
      <TaskSummaryListView
        activeFilter="todo"
        doneCount={1}
        onFilterChange={onFilterChange}
        onSelectTask={() => {}}
        overdueCount={0}
        tasks={[]}
        todoCount={1}
        unassignedCount={0}
        users={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', {name: '1 Done'}))
    fireEvent.click(screen.getByRole('button', {name: '0 Overdue'}))

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onFilterChange).toHaveBeenCalledWith('done')
  })

  it('renders description, compact assignee, due-date badge, and comment count badge', () => {
    mockUseTaskComments.mockReturnValue({comments: [{_id: 'comment-1'}, {_id: 'comment-2'}]})

    renderWithTheme(
      <TaskSummaryListView
        activeFilter="todo"
        doneCount={0}
        onFilterChange={() => {}}
        onSelectTask={() => {}}
        overdueCount={0}
        tasks={
          [
            {
              _createdAt: '2026-04-01T00:00:00.000Z',
              _id: 'task-1',
              _type: 'tasks.task',
              _updatedAt: '2026-04-01T00:00:00.000Z',
              assignedTo: 'resource-user-2',
              authorId: 'resource-user-2',
              description: buildMessageFromPlainText('Task description text'),
              status: 'open',
              title: 'Task title',
            },
          ] as never
        }
        todoCount={1}
        unassignedCount={0}
        users={
          [
            {
              memberships: [{resourceUserId: 'resource-user-2'}],
              profile: {displayName: 'Sam Hemingway'},
            },
          ] as never
        }
      />,
    )

    expect(screen.getByText('Task description text')).toBeInTheDocument()
    expect(screen.getByText('Sam H')).toBeInTheDocument()
    expect(screen.queryByText('Sam Hemingway')).not.toBeInTheDocument()
    expect(screen.getByText('No date')).toBeInTheDocument()
    expect(screen.getByText('2 comments')).toBeInTheDocument()
    expect(screen.queryByText('To Do')).not.toBeInTheDocument()
    expect(screen.queryByText('6 days ago')).not.toBeInTheDocument()
  })
})
