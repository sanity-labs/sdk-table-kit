import path from 'path'

import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-day-picker/style.css': path.resolve(__dirname, '__mocks__/empty-style.ts'),
      'react-day-picker/src/style.css': path.resolve(__dirname, '__mocks__/empty-style.ts'),
      // 'sanity' is a peer dep (not installed in dev). Vitest auto-mock
      // from __mocks__/sanity.ts handles the default; individual tests
      // can override with vi.mock('sanity', ...)
      sanity: path.resolve(__dirname, '__mocks__/sanity.ts'),
    },
  },
  test: {
    name: 'table-kit-sanity:component',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    fakeTimers: {
      shouldAdvanceTime: true,
    },
    server: {
      deps: {
        inline: ['@sanity-labs/react-table-kit', 'react-day-picker'],
      },
    },
  },
})
