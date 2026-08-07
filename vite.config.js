import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
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

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function createViteConfig(env = {}, sentryPlugin = sentryVitePlugin) {
  const authToken = trimmed(env.SENTRY_AUTH_TOKEN)
  const org = trimmed(env.SENTRY_ORG)
  const project = trimmed(env.SENTRY_PROJECT)
  const release = trimmed(env.VERCEL_GIT_COMMIT_SHA)
  const uploadEnabled = Boolean(authToken && org && project)
  const plugins = [
    serviceRouteRewrite(),
    react({
      // Only apply React transform to files in src/services/
      include: ['src/services/**/*.jsx', 'src/services/**/*.js'],
    }),
  ]

  if (uploadEnabled) {
    const options = {
      authToken,
      org,
      project,
      sourcemaps: { filesToDeleteAfterUpload: 'dist/**/*.map' },
    }
    if (release) options.release = { name: release }
    plugins.push(sentryPlugin(options))
  }

  return {
    root: '.',
    plugins,
    build: {
      outDir: 'dist',
      sourcemap: uploadEnabled ? 'hidden' : false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          services: resolve(__dirname, 'services.html'),
          fireshift: resolve(__dirname, 'projects/fireshift.html'),
          'podcast-renamer': resolve(__dirname, 'projects/podcast-renamer.html'),
        },
      },
    },
    server: {
      port: 3000,
      open: true,
    },
    appType: 'mpa',
  }
}

export default defineConfig(() => createViteConfig(process.env))
