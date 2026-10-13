import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { fileURLToPath } from 'node:url'

const BASE_URL = process.env.BASE_URL || '';
const WRANGLER_CONFIG = fileURLToPath(new URL('./worker/wrangler.jsonc', import.meta.url));


// https://vite.dev/config/
export default defineConfig({
  root: 'webapp',
  plugins: [react(), cloudflare({ configPath: WRANGLER_CONFIG, remoteBindings: false })],
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