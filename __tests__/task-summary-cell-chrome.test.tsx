import {screen} from '@testing-library/react'
import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {TaskSummaryCellInner} from '../src/components/tasks/TaskSummaryCellInner'
import {renderWithTheme} from './helpers'

const {mockUseAddonTasks} = vi.hoisted(() => ({
  mockUseAddonTasks: vi.fn(),
}))

vi.mock('../src/hooks/useAddonTasks', () => ({
  useAddonTasks: mockUseAddonTasks,
}))

vi.mock('../src/components/tasks/TaskSummaryAddComposer', () => ({
  TaskSummaryAddComposer: () => null,
}))

vi.mock('../src/components/tasks/TaskSummaryDetailView', () => ({
  TaskSummaryDetailView: () => null,
}))

vi.mock('../src/components/tasks/TaskSummaryListView', () => ({
  TaskSummaryListView: () => null,
}))

vi.mock('@sanity/sdk-react', () => ({
  useUsers: () => ({data: []}),
}))

vi.mock('@sanity/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sanity/ui')>()
  type MockPopoverProps = React.ComponentProps<typeof actual.Popover>

  return {
    ...actual,
    Popover: React.forwardRef(function MockPopover(
      {children, content, open}: MockPopoverProps,
      _ref: React.ForwardedRef<HTMLDivElement>,
    ) {
      return (
        <>
          {open && content ? <div data-testid="mock-popover">{content}</div> : null}
          {children}
        </>
      )
    }),
  }
})

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

describe('TaskSummaryCellInner chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders shared empty-state chrome when no tasks exist', () => {
    mockUseAddonTasks.mockReturnValue({tasks: []})

    renderWithTheme(<TaskSummaryCellInner documentId="doc-1" documentType="article" />)

    const emptyShell = screen.getByTestId('task-empty-state')
    expect(emptyShell).toHaveAttribute('data-state', 'empty')
    expect(emptyShell).toHaveAttribute('data-border', 'false')
    expect(screen.getByText('Add task')).toBeInTheDocument()
  })

  it('renders shared filled-state chrome when tasks exist', () => {
    mockUseAddonTasks.mockReturnValue({
      tasks: [
        {
          _createdAt: '2026-04-01T00:00:00.000Z',
          _id: 'task-1',
          _updatedAt: '2026-04-01T00:00:00.000Z',
          assignedTo: 'resource-user-1',
          dueBy: undefined,
          status: 'open',
          title: 'Review story',
        },
      ],
    })

    renderWithTheme(<TaskSummaryCellInner documentId="doc-1" documentType="article" />)

    const filledShell = screen.getByTestId('task-summary-state')
    expect(filledShell).toHaveAttribute('data-state', 'filled')
    expect(filledShell).toHaveAttribute('data-border', 'true')
    expect(screen.getByText('1 open')).toBeInTheDocument()
  })
})
