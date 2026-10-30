import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api to Flask and adds the API key on the server
// side, so the key never ships to the browser. It reads API_KEY from
// ../backend/.env, or SMARTBED_API_KEY / SMARTBED_API_URL from frontend/.env.local.
export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../backend'), 'API_KEY')
  const env = loadEnv(mode, __dirname, 'SMARTBED_')
  const apiKey = env.SMARTBED_API_KEY || backendEnv.API_KEY || ''
  const proxy = {
    '/api': {
      target: env.SMARTBED_API_URL || 'http://127.0.0.1:5000',
      changeOrigin: true,
      headers: { 'X-API-Key': apiKey },
    },
  }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
