import {fireEvent, screen} from '@testing-library/react'
import React from 'react'
import {describe, expect, it, vi} from 'vitest'

import {
  renderEmptyReferenceCell,
  renderPreparedReference,
} from '../src/helpers/references/referenceCellDisplay'
import {renderWithTheme} from './helpers'

describe('referenceCellDisplay chrome', () => {
  it('renders empty state with shared chrome semantics', () => {
    renderWithTheme(<>{renderEmptyReferenceCell('Select Author')}</>)

    const emptyShell = screen.getByTestId('reference-empty-state')
    expect(emptyShell).toHaveAttribute('data-state', 'empty')
    expect(emptyShell).toHaveAttribute('data-border', 'false')
    expect(screen.getByText('Select Author')).toBeInTheDocument()
  })

  it('renders filled state with title/subtitle in shared chrome', () => {
    renderWithTheme(
      <>
        {renderPreparedReference({
          subtitle: 'Senior Writer',
          title: 'Alice Author',
        })}
      </>,
    )

    const filledShell = screen.getByText('Alice Author').closest('[data-state="filled"]')
    expect(filledShell).toHaveAttribute('data-border', 'true')
    expect(screen.getByText('Alice Author')).toBeInTheDocument()
    expect(screen.getByText('Senior Writer')).toBeInTheDocument()
  })

  it('renders avatar slot when media is present in preview shape', () => {
    renderWithTheme(
      <>
        {renderPreparedReference({
          media: null,
          title: 'Bob Writer',
        })}
      </>,
    )

    expect(screen.getByTestId('reference-avatar')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders button chrome when editable callback is provided', () => {
    const onPress = vi.fn()

    renderWithTheme(
      <>
        {renderPreparedReference(
          {
            subtitle: 'Senior Writer',
            title: 'Alice Author',
          },
          onPress,
        )}
      </>,
    )

    const button = screen.getByRole('button', {name: /Alice Author/i})
    fireEvent.click(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
