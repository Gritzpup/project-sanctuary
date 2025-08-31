import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    historyApiFallback: true,
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
        target: 'http://localhost:4827',
        changeOrigin: true
      }
    }
  }
})
