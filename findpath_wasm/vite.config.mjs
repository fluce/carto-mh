import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'www',
  server: {
    fs: {
      allow: [resolve('.')],
    },
  },
  build: {
    outDir: '../dist-findpath-wasm',
    emptyOutDir: true,
  },
})