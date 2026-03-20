import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cloudflare } from "@cloudflare/vite-plugin"
import path from 'path'

// Base44 removed — now using Supabase + Cloudflare
export default defineConfig({
  logLevel: 'error',
  plugins: [
    react(),
    cloudflare(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
