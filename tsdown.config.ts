import {defineConfig} from 'tsdown'

export default defineConfig({
  clean: true,
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: true,
  entry: ['src/index.ts'],
  fixedExtension: false,
  format: ['esm'],
  outDir: 'dist',
  target: 'es2022',
  tsconfig: './tsconfig.build.json',
})
