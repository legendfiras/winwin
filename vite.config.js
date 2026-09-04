import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const localImageDirs = [
  path.join(rootDir, 'assets', 'products'),
  path.join(rootDir, 'New folder', 'downloaded_images'),
  path.join(rootDir, 'downloaded_images'),
]

function serveLocalProductImages() {
  const mime = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return {
    name: 'local-product-images',
    configureServer(server) {
      server.middlewares.use('/img', (req, res, next) => {
        const filename = decodeURIComponent((req.url || '').split('?')[0].replace(/^\/+/, ''))
        if (!filename || filename.includes('..')) return next()
        for (const dir of localImageDirs) {
          const filePath = path.join(dir, filename)
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', mime[path.extname(filename).toLowerCase()] || 'application/octet-stream')
            res.setHeader('Cache-Control', 'public, max-age=3600')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      '@': path.join(rootDir, 'src'),
    },
  },
  plugins: [
    serveLocalProductImages(),
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
})
