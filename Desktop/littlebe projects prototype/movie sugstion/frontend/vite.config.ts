import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vitest runs component tests (Navbar, MovieRow, HybridSlider) via `npm test`.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 5173, host: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
