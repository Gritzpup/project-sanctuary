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
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
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
      '/api': {
        target: 'http://localhost:4828',
        changeOrigin: true
      }
    }
  },
  // 🚀 PHASE 16b: Build optimization and tree-shaking
  build: {
    target: 'ES2020',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor code into separate chunk for better caching
        manualChunks: (id) => {
          if (id.includes('lightweight-charts')) {
            return 'chart-lib';
          }
          if (id.includes('node_modules')) {
            // Group other node_modules together
            if (id.includes('@sveltejs')) {
              return 'svelte';
            }
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
