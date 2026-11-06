import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../backend'), 'API_KEY')
  const env = loadEnv(mode, __dirname, 'SMARTBED_')
  const api = env.SMARTBED_API_KEY || backendEnv.API_KEY || ''
  const proxy = {
    '/api': {
      target: env.SMARTBED_API_URL || 'http://127.0.0.1:5000',
      changeOrigin: true,
      headers: { 'X-API-Key': api },
    },
  }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
