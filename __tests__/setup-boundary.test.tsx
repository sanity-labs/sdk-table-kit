import {render, screen} from '@testing-library/react'
import React from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {
  SdkTableKitSetupBoundary,
  getSdkTableKitSetupDiagnostic,
} from '../src/components/table/SdkTableKitSetupBoundary'

function ThrowingChild({error}: {error: Error}) {
  throw error
}

describe('SdkTableKitSetupBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a clear diagnostic for a missing nuqs adapter', () => {
    render(
      <SdkTableKitSetupBoundary>
        <ThrowingChild
          error={new Error('[nuqs] requires an adapter to work with your framework')}
        />
      </SdkTableKitSetupBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Missing nuqs adapter')
    expect(screen.getByRole('alert')).toHaveTextContent('nuqs/adapters/react')
  })

  it('renders a clear diagnostic for a missing Sanity UI theme', () => {
    render(
      <SdkTableKitSetupBoundary>
        <ThrowingChild error={new Error('theme.sanity is undefined')} />
      </SdkTableKitSetupBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Missing Sanity UI theme')
    expect(screen.getByRole('alert')).toHaveTextContent('ThemeProvider')
  })

  it('does not classify unrelated errors as setup failures', () => {
    expect(getSdkTableKitSetupDiagnostic(new Error('Unexpected table bug'))).toBeNull()
  })
})
