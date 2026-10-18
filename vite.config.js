import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Dev middleware to rewrite service routes to services.html (matches vercel.json rewrites)
function serviceRouteRewrite() {
  const serviceRoutes = [
    '/marine', '/hull-cleaning', '/hull-cleaning/calculator', '/hull-cleaning/order',
    '/boat-detailing', '/sailing-lessons', '/sailing-lessons/faq', '/deliveries',
    '/terms', '/recurring-authorization',
  ]
  return {
    name: 'service-route-rewrite',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (serviceRoutes.includes(url)) {
          req.url = '/services.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '')
        }
        next()
      })
    },
  }
}

export default defineConfig({
  root: '.',
  plugins: [
    serviceRouteRewrite(),
    react({
      // Only apply React transform to files in src/services/
      include: ['src/services/**/*.jsx', 'src/services/**/*.js'],
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        services: resolve(__dirname, 'services.html'),
        fireshift: resolve(__dirname, 'projects/fireshift.html'),
        'perimeter-supervisor': resolve(__dirname, 'projects/perimeter-supervisor.html'),
        'podcast-renamer': resolve(__dirname, 'projects/podcast-renamer.html'),
      },
      output: {
        // posthog-js is only ever dynamically imported (src/analytics.js); a
        // named chunk keeps it out of the entry bundles and lets
        // scripts/prerender.mjs assert it is never fetched while prerendering.
        manualChunks(id) {
          if (id.includes('/node_modules/posthog-js/')) return 'posthog'
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  appType: 'mpa',
})
