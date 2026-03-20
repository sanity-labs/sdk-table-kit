import {DocumentTable} from '@sanetti/sanity-table-kit'
import {screen, within, fireEvent} from '@testing-library/react'
import React from 'react'
import {describe, it, expect, vi, beforeAll} from 'vitest'

import {column} from '../src/column'
import {renderWithTheme} from './helpers'

// Mock @sanity/sdk-react
const mockNavigate = vi.fn()

vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({id: 'user1', name: 'Test', roles: [{name: 'editor', title: 'Editor'}]}),
  useClient: () => ({config: () => ({projectId: 'test-project', dataset: 'production'})}),
  useNavigateToStudioDocument: vi.fn(() => ({navigateToStudioDocument: mockNavigate})),
}))

vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
}))

// Mock window.matchMedia for Sanity UI
beforeAll(() => {
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
})

const mockData = [
  {_id: 'doc-1', _type: 'article', title: 'Alpha'},
  {_id: 'doc-2', _type: 'page', title: 'Beta'},
]

describe('column.openInStudio()', () => {
  it('Behavior 1 [TRACER]: renders a button with title "Open in Studio"', () => {
    renderWithTheme(
      <DocumentTable data={[mockData[0]]} columns={[column.title(), column.openInStudio()]} />,
    )

    const button = screen.getByTitle('Open in Studio')
    expect(button).toBeInTheDocument()
  })

  it('Behavior 2: respects custom width', () => {
    const col = column.openInStudio({width: 60})
    expect(col.width).toBe(60)
  })

  it('Behavior 3: clicking the button calls navigateToStudioDocument', () => {
    mockNavigate.mockClear()

    renderWithTheme(
      <DocumentTable data={[mockData[0]]} columns={[column.title(), column.openInStudio()]} />,
    )

    const button = screen.getByTitle('Open in Studio')
    fireEvent.click(button)

    expect(mockNavigate).toHaveBeenCalled()
  })
})
