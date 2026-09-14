import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCatalogQuery } from './src/lib/categories.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const localImageDirs = [
  path.join(rootDir, 'assets', 'products'),
  path.join(rootDir, 'New folder', 'downloaded_images'),
  path.join(rootDir, 'downloaded_images'),
  path.join(rootDir, 'public', 'img'),
]

function jsonFile(rel) {
  const file = path.join(rootDir, rel)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function serveLocalStore() {
  const defaults = [
    { setting_key: 'whatsapp_number', setting_value: '0096181629538', id: 'local-wa' },
    { setting_key: 'background_color', setting_value: '#FFF8F0', id: 'local-bg' },
    { setting_key: 'admin_password', setting_value: '1234', id: 'local-admin' },
    { setting_key: 'customer_feedback', setting_value: '', id: 'local-fb' },
    { setting_key: 'winwin_card_image', setting_value: '', id: 'local-card' },
    { setting_key: 'points_earn_per_usd', setting_value: '1', id: 'local-earn-rate' },
    { setting_key: 'points_earn_min_usd', setting_value: '15', id: 'local-earn-min' },
  ]
  return {
    name: 'local-cloudflare-store',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (req.method === 'GET' && url.startsWith('/api/products/')) {
          const id = decodeURIComponent(url.slice('/api/products/'.length))
          const products = jsonFile(path.join('public', 'data', 'products.json')) || []
          const product = products.find((p) => String(p.id) === String(id))
          res.setHeader('Content-Type', 'application/json')
          if (!product) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'not found' }))
            return
          }
          res.end(JSON.stringify(product))
          return
        }
        if (req.method === 'GET' && url === '/api/products') {
          const products = jsonFile(path.join('public', 'data', 'products.json')) || []
          const parsed = new URL(req.url, 'http://localhost')
          if (parsed.searchParams.has('page') || parsed.searchParams.has('limit')) {
            const catalog = applyCatalogQuery(products, {
              cat: parsed.searchParams.get('cat') || '',
              q: parsed.searchParams.get('q') || '',
              sort: parsed.searchParams.get('sort') || 'featured',
              page: parsed.searchParams.get('page'),
              limit: parsed.searchParams.get('limit'),
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(catalog))
            return
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(products))
          return
        }
        if (req.method === 'GET' && url === '/api/settings') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(defaults))
          return
        }
        if (req.method === 'POST' && url === '/api/settings') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            let parsed = {}
            try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
            const key = String(parsed.setting_key || '')
            const value = String(parsed.setting_value ?? '')
            res.setHeader('Content-Type', 'application/json')
            if (!key) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'setting_key required' }))
              return
            }
            let row = defaults.find((s) => s.setting_key === key)
            if (row) row.setting_value = value
            else {
              row = { setting_key: key, setting_value: value, id: `local-${key}` }
              defaults.push(row)
            }
            res.end(JSON.stringify(row))
          })
          return
        }
        if (req.method === 'GET' && url === '/api/slides') {
          res.setHeader('Content-Type', 'application/json')
          res.end('[]')
          return
        }
        if (req.method === 'POST' && url === '/api/fn/adminLogin') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            let password = ''
            try { password = String(JSON.parse(body || '{}').password || '').trim() } catch { password = '' }
            res.setHeader('Content-Type', 'application/json')
            if (password === '1234') {
              res.end(JSON.stringify({ success: true, admin_session_token: 'local-dev-token', admin_session_id: 'local' }))
              return
            }
            res.statusCode = 401
            res.end(JSON.stringify({ error: 'Incorrect password. Local starter password is 1234.' }))
          })
          return
        }
        next()
      })
    },
  }
}

function serveLocalProductImages() {
  const mime = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
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
    serveLocalStore(),
    serveLocalProductImages(),
    react(),
  ],
})
