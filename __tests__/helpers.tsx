import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {render, type RenderOptions} from '@testing-library/react'
import {NuqsTestingAdapter} from 'nuqs/adapters/testing'
import type {ReactElement} from 'react'

const theme = buildTheme()

function Wrapper({children}: {children: React.ReactNode}) {
  return (
    <ThemeProvider theme={theme}>
      <NuqsTestingAdapter hasMemory>{children}</NuqsTestingAdapter>
    </ThemeProvider>
  )
}

export function renderWithTheme(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {wrapper: Wrapper, ...options})
}
