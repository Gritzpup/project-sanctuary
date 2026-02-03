import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    historyApiFallback: true,
    hmr: {
      host: '192.168.1.51',
      port: 5173,
      clientPort: 5173
    },
    proxy: {
      '/api/coinbase': {
        target: 'https://api.exchange.coinbase.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coinbase/, ''),
        secure: true,
        timeout: 30000,
        configure: (proxy, _options) => {
          // Reduced logging - commented for cleaner output
          // proxy.on('error', (err, _req, _res) => {
          //   console.log('Proxy error:', err);
          // });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            // Disabled verbose logging
            // console.log('Sending Request to the Target:', req.method, req.url);
          });
        }
      },
      '/api/trading': {
        target: 'http://localhost:4828',
        changeOrigin: true
      },
      '/api/time': {
        target: 'http://localhost:4828',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:4828',
        changeOrigin: true
      }
    }
  },
  // 🚀 PHASE 16b: Build optimization and tree-shaking
  // 🚀 PHASE 17c: Route-based code splitting for faster initial load
  build: {
    target: 'ES2020',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        // 🚀 PHASE 17: Split route-specific code into separate chunks
        // Each route loads only its dependencies, reducing initial bundle
        manualChunks: (id) => {
          // High-priority splits (heavy dependencies)
          if (id.includes('lightweight-charts')) {
            return 'chart-lib';
          }

          // 🚀 PHASE 17: Route-specific chunks
          // Chart route: chart components, plugins, services
          if (
            id.includes('pages/trading/chart') &&
            (id.includes('components') ||
              id.includes('plugins') ||
              id.includes('services') ||
              id.includes('stores') ||
              id.includes('hooks'))
          ) {
            return 'chart-route';
          }

          // Orderbook route: orderbook components and services
          if (
            id.includes('pages/trading/orderbook') &&
            (id.includes('components') ||
              id.includes('services') ||
              id.includes('stores') ||
              id.includes('utils'))
          ) {
            return 'orderbook-route';
          }

          // Analytics route (if exists)
          if (
            id.includes('pages/trading/analytics') ||
            id.includes('pages/analytics')
          ) {
            return 'analytics-route';
          }

          // Settings route (if exists)
          if (id.includes('pages/settings')) {
            return 'settings-route';
          }

          // Node modules splitting
          if (id.includes('node_modules')) {
            // Separate Svelte framework from other vendors
            if (id.includes('@sveltejs')) {
              return 'svelte-framework';
            }
            // Separate UI/styling libraries
            if (id.includes('recharts') || id.includes('d3')) {
              return 'viz-libs';
            }
            // Everything else
            return 'vendor';
          }
        },

        // Optimize chunk names
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: '[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      },

      // Tree-shake unused code
      treeshake: {
        moduleSideEffects: false
      }
    }
  }
})
