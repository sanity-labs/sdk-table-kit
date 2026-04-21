import {screen} from '@testing-library/react'
import React from 'react'
import {describe, expect, it, vi} from 'vitest'

import {CommentableCellFrame} from '../src/components/comments/CommentableCellFrame'
import {renderWithTheme} from './helpers'

vi.mock('../src/components/comments/SharedCommentsPanel', () => ({
  SharedCommentsPanel: () => <div>Shared comments panel</div>,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('CommentableCellFrame', () => {
  it('keeps non-text content centered by default', () => {
    renderWithTheme(
      <CommentableCellFrame
        cellPadding={{x: 16, y: 10}}
        commentFieldLabel="Title"
        commentFieldPath="title"
        commentsState={{comments: []} as never}
        documentId="article-1"
        documentTitle="Test article"
        documentType="article"
        onHoverChange={() => {}}
        open={false}
        setOpen={() => {}}
        showTrigger={false}
        totalCount={0}
        unresolvedCount={0}
      >
        <div>Cell content</div>
      </CommentableCellFrame>,
    )

    const content = screen.getByTestId('commentable-cell-content')
    const root = screen.getByTestId('commentable-cell-root')

    expect(root).toHaveStyle({
      alignItems: 'stretch',
      alignSelf: 'stretch',
      display: 'flex',
      minWidth: '0',
      width: '100%',
    })

    expect(content.parentElement).toHaveStyle({
      alignSelf: 'stretch',
      alignItems: 'center',
      display: 'flex',
      flex: '1 1 0%',
      minWidth: '0',
    })

    expect(content).toHaveStyle({
      alignItems: 'center',
      display: 'flex',
      minHeight: '100%',
      minWidth: '0',
      width: '100%',
    })
  })

  it('does not render the bottom stripe just because the field has unresolved comments', () => {
    renderWithTheme(
      <CommentableCellFrame
        cellPadding={{x: 16, y: 10}}
        commentFieldLabel="Title"
        commentFieldPath="title"
        commentsState={{comments: []} as never}
        documentId="article-1"
        documentTitle="Test article"
        documentType="article"
        onHoverChange={() => {}}
        open={false}
        setOpen={() => {}}
        showTrigger={false}
        totalCount={2}
        unresolvedCount={2}
      >
        <div>Cell content</div>
      </CommentableCellFrame>,
    )

    const content = screen.getByTestId('commentable-cell-content')

    expect(content.parentElement).not.toHaveAttribute('data-edited-field')
    expect(content.parentElement?.getAttribute('style') ?? '').not.toContain('box-shadow')
  })

  it('renders the edited indicator tone when explicitly provided', () => {
    renderWithTheme(
      <CommentableCellFrame
        cellPadding={{x: 16, y: 10}}
        commentFieldLabel="Title"
        commentFieldPath="title"
        commentsState={{comments: []} as never}
        documentId="article-1"
        documentTitle="Test article"
        documentType="article"
        editedIndicatorTone="suggest"
        onHoverChange={() => {}}
        open={false}
        setOpen={() => {}}
        showTrigger={false}
        totalCount={0}
        unresolvedCount={0}
      >
        <div>Cell content</div>
      </CommentableCellFrame>,
    )

    const content = screen.getByTestId('commentable-cell-content')

    expect(content.parentElement).toHaveAttribute('data-edited-field', 'true')
    expect(content.parentElement).toHaveAttribute('data-edited-tone', 'suggest')
  })
})
