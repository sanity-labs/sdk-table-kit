import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import React, {createRef} from 'react'
import {vi} from 'vitest'

import type {AddonMessage} from '../src/addonTypes'
import {CommentInput, type CommentInputHandle} from '../src/CommentInput'

const {mockUseUsers} = vi.hoisted(() => ({
  mockUseUsers: vi.fn(),
}))

vi.mock('@sanity/sdk-react', () => ({
  useUsers: mockUseUsers,
}))

const MOCK_USERS = [
  {
    memberships: [{resourceUserId: 'resource-user-1'}],
    profile: {displayName: 'Sam Hemingway'},
    sanityUserId: 'sanity-user-1',
  },
]

const theme = buildTheme()

function renderCommentInput(element: React.ReactElement) {
  return render(element, {
    wrapper: ({children}) =>
      React.createElement(
        ThemeProvider,
        {theme},
        React.createElement(NuqsTestingAdapter, {hasMemory: true}, children),
      ),
  })
}

function normalizeMessage(message: AddonMessage) {
  return message?.map((block) => ({
    _type: block._type,
    children: block.children.map((child) =>
      child._type === 'mention'
        ? {_type: child._type, userId: child.userId}
        : {_type: child._type, text: child.text},
    ),
    style: block.style,
  }))
}

describe('CommentInput', () => {
  beforeEach(() => {
    mockUseUsers.mockReturnValue({data: MOCK_USERS})
  })

  it('hydrates from AddonMessage and preserves serialization through the ref API', async () => {
    const ref = createRef<CommentInputHandle>()
    const initialValue: AddonMessage = [
      {
        _key: 'block-1',
        _type: 'block',
        children: [
          {_key: 'span-1', _type: 'span', text: 'Hello '},
          {_key: 'mention-1', _type: 'mention', userId: 'resource-user-1'},
          {_key: 'span-2', _type: 'span', text: ' world'},
        ],
        markDefs: [],
        style: 'normal',
      },
    ]

    renderCommentInput(React.createElement(CommentInput, {initialValue, ref, showSendButton: true}))

    const textbox = screen.getByRole('textbox')
    await waitFor(() => {
      expect(textbox).toHaveTextContent('Hello @Sam Hemingway world')
    })

    expect(normalizeMessage(ref.current?.getValue() ?? null)).toEqual([
      {
        _type: 'block',
        children: [
          {_type: 'span', text: 'Hello '},
          {_type: 'mention', userId: 'resource-user-1'},
          {_type: 'span', text: ' world'},
        ],
        style: 'normal',
      },
    ])
  })

  it('hides the placeholder on focus and keeps wrapping styles on the editor surface', async () => {
    const user = userEvent.setup()

    renderCommentInput(
      React.createElement(CommentInput, {placeholder: 'Add a comment...', showSendButton: true}),
    )

    const textbox = screen.getByRole('textbox')
    expect(screen.getByText('Add a comment...')).toBeInTheDocument()
    expect(textbox).toHaveStyle('white-space: pre-wrap')
    expect(textbox).toHaveStyle('overflow-wrap: anywhere')
    expect(textbox).toHaveStyle('width: 100%')

    await user.click(textbox)

    expect(screen.queryByText('Add a comment...')).not.toBeInTheDocument()
  })

  it('inserts mentions and serializes them back to AddonMessage', async () => {
    const user = userEvent.setup()
    const ref = createRef<CommentInputHandle>()

    renderCommentInput(React.createElement(CommentInput, {ref, showSendButton: true}))

    const textbox = screen.getByRole('textbox')
    await user.click(textbox)
    await user.type(textbox, '@sa')

    const mentionOption = await screen.findByText('Sam Hemingway')
    await user.click(mentionOption)
    await user.type(textbox, 'hello')

    await waitFor(() => {
      expect(textbox).toHaveTextContent('@Sam Hemingway hello')
    })

    expect(normalizeMessage(ref.current?.getValue() ?? null)).toEqual([
      {
        _type: 'block',
        children: [
          {_type: 'mention', userId: 'resource-user-1'},
          {_type: 'span', text: ' hello'},
        ],
        style: 'normal',
      },
    ])
  })

  it('submits on Ctrl+Enter and cancels on Escape', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    renderCommentInput(
      React.createElement(CommentInput, {onCancel, onSubmit, showSendButton: true}),
    )

    const textbox = screen.getByRole('textbox')
    await user.click(textbox)
    await user.type(textbox, 'Status update')
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(normalizeMessage(onSubmit.mock.calls[0]?.[0] ?? null)).toEqual([
      {
        _type: 'block',
        children: [{_type: 'span', text: 'Status update'}],
        style: 'normal',
      },
    ])

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
