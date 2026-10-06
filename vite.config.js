import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  // Offline runners select a fresh empty directory before Vite loads any dotenv files.
  const envDir = process.env.MODEER_TEST_ENV_DIR || process.cwd();
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };
  if (command === 'build' && env.VERCEL && !/^https:\/\/[^/?#\s]+\/api\/v1\/?$/.test(env.VITE_API_BASE_URL || '')) {
    throw new Error('Set VITE_API_BASE_URL in Vercel to the HTTPS backend URL ending in /api/v1.');
  }
  const proxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
      changeOrigin: true,
      ws: true,
    },
  };
  return { envDir, plugins: [react()], server: { proxy }, preview: { proxy } };
})
