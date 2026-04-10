import {fireEvent, screen, waitFor} from '@testing-library/react'
import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {TaskSummaryCellInner} from '../src/components/tasks/TaskSummaryCellInner'
import {renderWithTheme} from './helpers'

const {mockUseAddonTasks, mockViewState} = vi.hoisted(() => ({
  mockUseAddonTasks: vi.fn(),
  mockViewState: {
    detailFlushResults: [] as boolean[],
  },
}))

vi.mock('../src/hooks/useAddonTasks', () => ({
  useAddonTasks: mockUseAddonTasks,
}))

vi.mock('../src/components/tasks/TaskSummaryAddComposer', () => ({
  TaskSummaryAddComposer: () => null,
}))

vi.mock('../src/components/tasks/TaskSummaryEditorView', () => ({
  TaskSummaryEditorView: ({
    onBack,
    onRegisterFlushPending,
  }: {
    onBack: () => void
    onRegisterFlushPending?: (flushFn: null | (() => Promise<boolean>)) => void
  }) => {
    React.useEffect(() => {
      onRegisterFlushPending?.(async () => mockViewState.detailFlushResults.shift() ?? true)
      return () => {
        onRegisterFlushPending?.(null)
      }
    }, [onRegisterFlushPending])

    return (
      <button onClick={onBack} type="button">
        Mock detail back
      </button>
    )
  },
}))

vi.mock('../src/components/tasks/TaskSummaryListView', () => ({
  TaskSummaryListView: ({onSelectTask}: {onSelectTask: (taskId: string) => void}) => (
    <button
      onClick={() => {
        onSelectTask('task-1')
      }}
      type="button"
    >
      Open first task
    </button>
  ),
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
    mockViewState.detailFlushResults = []
  })

  it('renders shared empty-state chrome when no tasks exist', () => {
    mockUseAddonTasks.mockReturnValue({isTasksLoading: false, tasks: []})

    renderWithTheme(<TaskSummaryCellInner documentId="doc-empty" documentType="article" />)

    const emptyShell = screen.getByTestId('task-empty-state')
    expect(emptyShell).toHaveAttribute('data-state', 'empty')
    expect(emptyShell).toHaveAttribute('data-border', 'false')
    expect(screen.getByText('Add task')).toBeInTheDocument()
  })

  it('renders shared filled-state chrome when tasks exist', () => {
    mockUseAddonTasks.mockReturnValue({
      isTasksLoading: false,
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

    renderWithTheme(<TaskSummaryCellInner documentId="doc-filled" documentType="article" />)

    const filledShell = screen.getByTestId('task-summary-state')
    expect(filledShell).toBeInTheDocument()
    expect(screen.getByText('1 Todo')).toBeInTheDocument()
  })

  it('keeps detail open until registered flush succeeds on back', async () => {
    mockUseAddonTasks.mockReturnValue({
      isTasksLoading: false,
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
    mockViewState.detailFlushResults = [false, true]

    renderWithTheme(<TaskSummaryCellInner documentId="doc-back-flush" documentType="article" />)

    const trigger = screen.getByTestId('task-summary-state').querySelector('button')
    expect(trigger).toBeTruthy()
    fireEvent.click(trigger!)
    if (!screen.queryByRole('button', {name: 'Open first task'})) {
      fireEvent.click(trigger!)
    }

    fireEvent.click(screen.getByRole('button', {name: 'Open first task'}))
    expect(screen.getByRole('button', {name: 'Mock detail back'})).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {name: 'Mock detail back'}))
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Mock detail back'})).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', {name: 'Mock detail back'}))
    await waitFor(() => {
      expect(screen.queryByRole('button', {name: 'Mock detail back'})).not.toBeInTheDocument()
      expect(screen.getByRole('button', {name: 'Open first task'})).toBeInTheDocument()
    })
  })

  it('opens the task list popover when a summary badge is clicked', () => {
    mockUseAddonTasks.mockReturnValue({
      isTasksLoading: false,
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

    renderWithTheme(<TaskSummaryCellInner documentId="doc-badge-open" documentType="article" />)

    fireEvent.click(screen.getByRole('button', {name: /Open tasks/}))
    expect(screen.getByTestId('mock-popover')).toBeInTheDocument()
  })
})
