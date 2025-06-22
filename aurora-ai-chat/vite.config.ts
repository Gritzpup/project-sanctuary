import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 1424,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext'
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
});
