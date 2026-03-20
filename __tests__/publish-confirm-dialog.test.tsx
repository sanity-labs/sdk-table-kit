import {screen, waitFor} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'

import {PublishConfirmDialog} from '../src/PublishConfirmDialog'
import {renderWithTheme} from './helpers'

// Track the mock so we can change behavior per-test
const mockUseDocumentPermissions = vi.fn()

// Mock @sanity/sdk-react
vi.mock('@sanity/sdk-react', () => ({
  useApplyDocumentActions: () => vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({
    id: 'user1',
    name: 'Test',
    roles: [{name: 'editor', title: 'Editor'}],
  }),
  useDocumentPermissions: (...args: unknown[]) => mockUseDocumentPermissions(...args),
}))

// Mock @sanity/sdk
vi.mock('@sanity/sdk', () => ({
  createDocument: vi.fn(() => ({type: 'createDocument'})),
  publishDocument: (doc: {documentId: string}) => ({
    type: 'document.publish',
    documentId: doc.documentId,
  }),
}))

// Mock window.matchMedia for Sanity UI Dialog
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

const mockDocuments = [
  {_id: 'doc-1', _type: 'article', title: 'First Article'},
  {_id: 'doc-2', _type: 'article', title: 'Second Article'},
  {_id: 'doc-3', _type: 'article', title: 'Third Article'},
]

describe('PublishConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDocumentPermissions.mockReturnValue({allowed: true})
  })

  it('Behavior 1 [TRACER]: renders dialog with title and document list', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    renderWithTheme(
      <PublishConfirmDialog documents={mockDocuments} onConfirm={onConfirm} onClose={onClose} />,
    )

    // Dialog title should contain "Publish 3 documents"
    // (appears in both header and button, so use getAllByText)
    const matches = screen.getAllByText('Publish 3 documents')
    expect(matches.length).toBeGreaterThanOrEqual(1)

    // All document titles should be visible
    expect(screen.getByText('First Article')).toBeInTheDocument()
    expect(screen.getByText('Second Article')).toBeInTheDocument()
    expect(screen.getByText('Third Article')).toBeInTheDocument()
  })

  it('Behavior 2: Cancel button calls onClose without publishing', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    renderWithTheme(
      <PublishConfirmDialog documents={mockDocuments} onConfirm={onConfirm} onClose={onClose} />,
    )

    await user.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Behavior 3: Publish button calls onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    renderWithTheme(
      <PublishConfirmDialog documents={mockDocuments} onConfirm={onConfirm} onClose={onClose} />,
    )

    // The publish button has the same text as the title
    const publishButtons = screen.getAllByText('Publish 3 documents')
    // One is the header, one is the button — click the button
    const publishButton = publishButtons.find((el) => el.closest('button') !== null)
    expect(publishButton).toBeDefined()
    await user.click(publishButton!)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Behavior 4: shows loading/disabled state when isPublishing is true', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    renderWithTheme(
      <PublishConfirmDialog
        documents={mockDocuments}
        onConfirm={onConfirm}
        onClose={onClose}
        isPublishing
      />,
    )

    // The publish button should be disabled
    const publishButtons = screen.getAllByText('Publish 3 documents')
    const publishButton = publishButtons.find((el) => el.closest('button') !== null)
    expect(publishButton).toBeDefined()
    expect(publishButton!.closest('button')).toBeDisabled()

    // A spinner/loading indicator should be visible
    expect(screen.getByTestId('publish-spinner')).toBeInTheDocument()
  })

  it('Behavior 5: documents without permission shown with explanation', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    // Mock permissions: doc-2 is denied
    mockUseDocumentPermissions.mockImplementation((action: {documentId: string}) => {
      if (action.documentId === 'doc-2') {
        return {allowed: false, message: 'Insufficient permissions'}
      }
      return {allowed: true}
    })

    renderWithTheme(
      <PublishConfirmDialog documents={mockDocuments} onConfirm={onConfirm} onClose={onClose} />,
    )

    // The denied document should show the permission message
    expect(screen.getByTestId('permission-denied-doc-2')).toBeInTheDocument()
    expect(screen.getByText('Insufficient permissions')).toBeInTheDocument()

    // Other documents should NOT have permission denied indicators
    expect(screen.queryByTestId('permission-denied-doc-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('permission-denied-doc-3')).not.toBeInTheDocument()
  })
})
