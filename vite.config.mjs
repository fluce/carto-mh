import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { cp } from 'node:fs/promises'
import sirv from 'sirv'

const BASE_URL = process.env.BASE_URL || '';
const dataDir = resolve(process.cwd(), 'public');


// https://vite.dev/config/
export default defineConfig({
  root: 'webapp',
  plugins: [{
    name: 'expose-data-directory',
    configureServer(server) {
      server.middlewares.use('/data', sirv(dataDir, { dev: true }));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/data', sirv(dataDir));
    },
    async closeBundle() {
      await cp(dataDir, resolve(process.cwd(), 'dist/data'), { recursive: true });
    },
  }, react()],
  base: BASE_URL,
  worker: {
    format: 'es',
  },
  build: {
    target: ['chrome89', 'edge89', 'firefox89', 'safari15', 'node15'],
    outDir: '../dist',
    assetsDir: '',
    emptyOutDir: true,
  }
})
