import React from 'react'

export type SdkTableKitSetupProblem = 'missing-nuqs-adapter' | 'missing-sanity-ui-theme'

export interface SdkTableKitSetupDiagnostic {
  problem: SdkTableKitSetupProblem
  title: string
  message: string
}

interface SdkTableKitSetupBoundaryState {
  diagnostic: SdkTableKitSetupDiagnostic | null
  error: unknown
}

export interface SdkTableKitSetupBoundaryProps {
  children: React.ReactNode
}

const NUQS_ADAPTER_MESSAGE = `@sanity-labs/sdk-table-kit uses nuqs for URL-backed table state, but no nuqs adapter was found.

Wrap your app with the adapter for your framework, for example:

import {NuqsAdapter} from 'nuqs/adapters/react'

<NuqsAdapter>
  <SanityDocumentTable {...props} />
</NuqsAdapter>

Use nuqs/adapters/next/app, nuqs/adapters/next/pages, nuqs/adapters/react-router/v6, or nuqs/adapters/react-router/v7 when those match your app.`

const SANITY_UI_THEME_MESSAGE = `@sanity-labs/sdk-table-kit renders @sanity/ui components, but no Sanity UI theme was found.

Wrap this surface with ThemeProvider and a Sanity theme, for example:

import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'

const theme = buildTheme()

<ThemeProvider theme={theme}>
  <SanityDocumentTable {...props} />
</ThemeProvider>

If this table renders inside Sanity Studio, use the Studio's existing theme boundary instead of nesting a second ThemeProvider.`

export function getSdkTableKitSetupDiagnostic(error: unknown): SdkTableKitSetupDiagnostic | null {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack ?? '') : ''
  const searchable = `${message}\n${stack}`.toLowerCase()

  if (searchable.includes('[nuqs]') && searchable.includes('adapter')) {
    return {
      problem: 'missing-nuqs-adapter',
      title: 'Missing nuqs adapter',
      message: NUQS_ADAPTER_MESSAGE,
    }
  }

  if (
    searchable.includes('theme.sanity') ||
    (searchable.includes('@sanity') && searchable.includes('v2') && searchable.includes('theme'))
  ) {
    return {
      problem: 'missing-sanity-ui-theme',
      title: 'Missing Sanity UI theme',
      message: SANITY_UI_THEME_MESSAGE,
    }
  }

  return null
}

export class SdkTableKitSetupBoundary extends React.Component<
  SdkTableKitSetupBoundaryProps,
  SdkTableKitSetupBoundaryState
> {
  state: SdkTableKitSetupBoundaryState = {
    diagnostic: null,
    error: null,
  }

  static getDerivedStateFromError(error: unknown): SdkTableKitSetupBoundaryState {
    return {
      diagnostic: getSdkTableKitSetupDiagnostic(error),
      error,
    }
  }

  render() {
    const {diagnostic, error} = this.state

    if (diagnostic) {
      return (
        <div
          role="alert"
          style={{
            border: '1px solid #d8d8d8',
            borderRadius: 6,
            fontFamily: 'system-ui, sans-serif',
            padding: 16,
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong>{diagnostic.title}</strong>
          <p>{diagnostic.message}</p>
        </div>
      )
    }

    if (error) {
      throw error
    }

    return this.props.children
  }
}
