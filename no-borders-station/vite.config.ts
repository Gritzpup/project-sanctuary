import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['@tauri-apps/api/core']
    }
  },
  define: {
    // Define globals for development
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@tauri-apps/api']
  }
})