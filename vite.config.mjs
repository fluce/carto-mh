import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE_URL = process.env.BASE_URL || '';


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: BASE_URL,
  build: {
    target: ['chrome89', 'edge89', 'firefox89', 'safari15', 'node15'],
  }
})
