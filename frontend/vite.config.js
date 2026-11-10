// Partly generated with Claude (Anthropic, 2026): proxy to FastAPI, API key removed.
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In development, Vite forwards /api/* to the FastAPI server, so the browser only ever
// talks to one origin (no CORS setup needed). Login now uses a JWT, so the old
// X-API-Key header is gone: no secret lives in the frontend at all.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'SMARTBED_')
  const proxy = {
    '/api': { target: env.SMARTBED_API_URL || 'http://127.0.0.1:8000', changeOrigin: true },
  }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
