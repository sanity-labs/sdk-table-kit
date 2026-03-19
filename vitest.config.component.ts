import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'

import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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
  },
})
