import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE_URL = process.env.BASE_URL || '';


// https://vite.dev/config/
export default defineConfig({
  root: 'webapp',
  plugins: [react()],
  base: BASE_URL,
  worker: {
    format: 'es',
  },
  build: {
    target: ['chrome89', 'edge89', 'firefox89', 'safari15', 'node15'],
    outDir: '../dist',
    assetsDir: '',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true
      }
    }
  }
})