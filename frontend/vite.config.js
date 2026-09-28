import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { applyBrandTokens, resolveBrand } from './src/config/brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function brandHtmlPlugin(mode) {
  const brand = resolveBrand({ ...process.env, ...loadEnv(mode, __dirname, '') })
  return {
    name: 'brand-html-tokens',
    transformIndexHtml: (html) => applyBrandTokens(html, brand),
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), brandHtmlPlugin(mode)],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: () => '/api/public/sitemap.xml',
      },
    },
  },
}))
