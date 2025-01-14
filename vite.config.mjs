import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: ['chrome89', 'edge89', 'firefox89', 'safari15', 'node15'],
  }
})
