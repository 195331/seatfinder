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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
          'vendor-radix': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-toast', '@radix-ui/react-tooltip'],
        },
      },
    },
  },
})
