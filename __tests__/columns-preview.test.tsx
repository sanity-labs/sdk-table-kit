import {render, screen} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {column} from '../src'
import {PreviewCell} from '../src/components/table/PreviewCell'
import {useColumnProjection} from '../src/hooks/useColumnProjection'

// Mock @sanity/sdk-react
const mockUseDocumentPreview = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useDocumentPreview: (...args: unknown[]) => mockUseDocumentPreview(...args),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

describe('columns.preview()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Behavior 1: PreviewCell renders title from useDocumentPreview', () => {
    mockUseDocumentPreview.mockReturnValue({
      title: 'My Article',
      subtitle: null,
      media: null,
    })

    render(<PreviewCell documentId="doc-1" documentType="article" />)

    expect(screen.getByText('My Article')).toBeInTheDocument()
  })

  it('Behavior 2: shows subtitle when available', () => {
    mockUseDocumentPreview.mockReturnValue({
      title: 'My Article',
      subtitle: 'Published yesterday',
      media: null,
    })

    render(<PreviewCell documentId="doc-1" documentType="article" />)

    expect(screen.getByText('My Article')).toBeInTheDocument()
    expect(screen.getByText('Published yesterday')).toBeInTheDocument()
  })

  it('Behavior 3: shows image when media URL is available', () => {
    mockUseDocumentPreview.mockReturnValue({
      title: 'My Article',
      subtitle: null,
      media: 'https://cdn.sanity.io/images/test.png',
    })

    render(<PreviewCell documentId="doc-1" documentType="article" />)

    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://cdn.sanity.io/images/test.png')
  })

  it('Behavior 4: fallback to document ID when no title', () => {
    mockUseDocumentPreview.mockReturnValue({
      title: null,
      subtitle: null,
      media: null,
    })

    render(<PreviewCell documentId="doc-1" documentType="article" />)

    expect(screen.getByText('doc-1')).toBeInTheDocument()
  })

  it('Behavior 5: preview column only needs _id and _type in projection', () => {
    const col = column.preview()
    const projection = useColumnProjection([col])
    // _id and _type are always included, preview doesn't add any extra fields
    expect(projection).toBe('{ _id, _type }')
  })

  it('Behavior 6: preview column is not sortable by default', () => {
    const col = column.preview()
    expect(col.sortable).toBe(false)
  })
})
