import {render, screen} from '@testing-library/react'
import React from 'react'
import {describe, expect, it} from 'vitest'

import {withEditedFieldIndicators} from '../src/helpers/table/withEditedFieldIndicators'

describe('withEditedFieldIndicators', () => {
  const cellPadding = {x: 16, y: 10}

  it('wraps changed comparable cells with the edited indicator tone', () => {
    const row = {_id: 'drafts.doc-1', _type: 'article', title: 'Draft title'}
    const columns = [{field: 'title', header: 'Title', id: 'title'}]
    const publishedRowsByBaseId = new Map([
      ['doc-1', {_id: 'doc-1', _type: 'article', title: 'Published title'}],
    ])

    const [column] = withEditedFieldIndicators(columns, {
      editedIndicatorTone: 'suggest',
      publishedRowsByBaseId,
    })

    render(
      <>
        {column.cellDecorator?.({
          cellPadding,
          content: <span>Draft title</span>,
          row,
          value: row.title,
        })}
      </>,
    )

    expect(screen.getByText('Draft title').closest('[data-edited-field="true"]')).toHaveAttribute(
      'data-edited-tone',
      'suggest',
    )
  })

  it('does not wrap unchanged comparable cells even when a draft or version row exists', () => {
    const row = {_id: 'versions.spring.doc-1', _type: 'article', title: 'Published title'}
    const columns = [{field: 'title', header: 'Title', id: 'title'}]
    const publishedRowsByBaseId = new Map([
      ['doc-1', {_id: 'doc-1', _type: 'article', title: 'Published title'}],
    ])

    const [column] = withEditedFieldIndicators(columns, {
      editedIndicatorTone: 'caution',
      publishedRowsByBaseId,
    })

    render(
      <>
        {column.cellDecorator?.({
          cellPadding,
          content: <span>Published title</span>,
          row,
          value: row.title,
        })}
      </>,
    )

    expect(screen.getByText('Published title').closest('[data-edited-field="true"]')).toBeNull()
  })

  it('does not show the indicator when no published baseline exists', () => {
    const row = {_id: 'drafts.doc-9', _type: 'article', title: 'Brand New'}
    const columns = [{field: 'title', header: 'Title', id: 'title'}]

    const [column] = withEditedFieldIndicators(columns, {
      editedIndicatorTone: 'default',
      publishedRowsByBaseId: new Map(),
    })

    render(
      <>
        {column.cellDecorator?.({
          cellPadding,
          content: <span>Brand New</span>,
          row,
          value: row.title,
        })}
      </>,
    )

    expect(screen.getByText('Brand New').closest('[data-edited-field="true"]')).toBeNull()
  })

  it('supports comment-enabled columns without requiring addon context for the edited stripe', () => {
    const row = {_id: 'drafts.doc-1', _type: 'article', title: 'Draft title'}
    const columns = [
      {
        comments: {fieldLabel: 'Title', fieldPath: 'title'},
        field: 'title',
        header: 'Title',
        id: 'title',
      },
    ]
    const publishedRowsByBaseId = new Map([
      ['doc-1', {_id: 'doc-1', _type: 'article', title: 'Published title'}],
    ])

    const [column] = withEditedFieldIndicators(columns, {
      editedIndicatorTone: 'default',
      publishedRowsByBaseId,
    })

    render(
      <>
        {column.cellDecorator?.({
          cellPadding,
          content: <span>Draft title</span>,
          row,
          value: row.title,
        })}
      </>,
    )

    expect(screen.getByText('Draft title').closest('[data-edited-field="true"]')).toHaveAttribute(
      'data-edited-tone',
      'default',
    )
  })

  it('uses strict deep comparison for projected array values', () => {
    const row = {_id: 'drafts.doc-1', _type: 'article', tags: ['a', 'b']}
    const columns = [{field: 'tags', header: 'Tags', id: 'tags'}]
    const publishedRowsByBaseId = new Map([
      ['doc-1', {_id: 'doc-1', _type: 'article', tags: ['b', 'a']}],
    ])

    const [column] = withEditedFieldIndicators(columns, {
      editedIndicatorTone: 'default',
      publishedRowsByBaseId,
    })

    render(
      <>
        {column.cellDecorator?.({
          cellPadding,
          content: <span>a,b</span>,
          row,
          value: row.tags,
        })}
      </>,
    )

    expect(screen.getByText('a,b').closest('[data-edited-field="true"]')).toHaveAttribute(
      'data-edited-tone',
      'default',
    )
  })
})
