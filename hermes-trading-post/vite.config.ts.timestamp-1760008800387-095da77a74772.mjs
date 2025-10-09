// vite.config.ts
import { defineConfig } from "file:///home/ubuntubox/Documents/Github/project-sanctuary/hermes-trading-post/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///home/ubuntubox/Documents/Github/project-sanctuary/hermes-trading-post/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
var vite_config_default = defineConfig({
  plugins: [svelte()],
  server: {
    host: true,
    // Allow external connections
    port: 5173,
    historyApiFallback: true,
    hmr: {
      port: 5173,
      host: true
      // Allow HMR connections from network machines
    },
    proxy: {
      "/api/coinbase": {
        target: "https://api.exchange.coinbase.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coinbase/, ""),
        secure: true,
        timeout: 3e4,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("Proxy error:", err);
          });
          proxy.on("proxyReq", (_proxyReq, req, _res) => {
          });
        }
      },
      "/api/trading": {
        target: "http://localhost:9080",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS91YnVudHVib3gvRG9jdW1lbnRzL0dpdGh1Yi9wcm9qZWN0LXNhbmN0dWFyeS9oZXJtZXMtdHJhZGluZy1wb3N0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS91YnVudHVib3gvRG9jdW1lbnRzL0dpdGh1Yi9wcm9qZWN0LXNhbmN0dWFyeS9oZXJtZXMtdHJhZGluZy1wb3N0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3VidW50dWJveC9Eb2N1bWVudHMvR2l0aHViL3Byb2plY3Qtc2FuY3R1YXJ5L2hlcm1lcy10cmFkaW5nLXBvc3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHsgc3ZlbHRlIH0gZnJvbSAnQHN2ZWx0ZWpzL3ZpdGUtcGx1Z2luLXN2ZWx0ZSdcblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbc3ZlbHRlKCldLFxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiB0cnVlLCAvLyBBbGxvdyBleHRlcm5hbCBjb25uZWN0aW9uc1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaGlzdG9yeUFwaUZhbGxiYWNrOiB0cnVlLFxuICAgIGhtcjoge1xuICAgICAgcG9ydDogNTE3MyxcbiAgICAgIGhvc3Q6IHRydWUgLy8gQWxsb3cgSE1SIGNvbm5lY3Rpb25zIGZyb20gbmV0d29yayBtYWNoaW5lc1xuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpL2NvaW5iYXNlJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2FwaS5leGNoYW5nZS5jb2luYmFzZS5jb20nLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9jb2luYmFzZS8sICcnKSxcbiAgICAgICAgc2VjdXJlOiB0cnVlLFxuICAgICAgICB0aW1lb3V0OiAzMDAwMCxcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XG4gICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVyciwgX3JlcSwgX3JlcykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1Byb3h5IGVycm9yOicsIGVycik7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKF9wcm94eVJlcSwgcmVxLCBfcmVzKSA9PiB7XG4gICAgICAgICAgICAvLyBEaXNhYmxlZCB2ZXJib3NlIGxvZ2dpbmdcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdTZW5kaW5nIFJlcXVlc3QgdG8gdGhlIFRhcmdldDonLCByZXEubWV0aG9kLCByZXEudXJsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICcvYXBpL3RyYWRpbmcnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTA4MCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1ksU0FBUyxvQkFBb0I7QUFDamEsU0FBUyxjQUFjO0FBR3ZCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxPQUFPLENBQUM7QUFBQSxFQUNsQixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLG9CQUFvQjtBQUFBLElBQ3BCLEtBQUs7QUFBQSxNQUNILE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQTtBQUFBLElBQ1I7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLGlCQUFpQjtBQUFBLFFBQ2YsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLG9CQUFvQixFQUFFO0FBQUEsUUFDdEQsUUFBUTtBQUFBLFFBQ1IsU0FBUztBQUFBLFFBQ1QsV0FBVyxDQUFDLE9BQU8sYUFBYTtBQUM5QixnQkFBTSxHQUFHLFNBQVMsQ0FBQyxLQUFLLE1BQU0sU0FBUztBQUNyQyxvQkFBUSxJQUFJLGdCQUFnQixHQUFHO0FBQUEsVUFDakMsQ0FBQztBQUNELGdCQUFNLEdBQUcsWUFBWSxDQUFDLFdBQVcsS0FBSyxTQUFTO0FBQUEsVUFHL0MsQ0FBQztBQUFBLFFBQ0g7QUFBQSxNQUNGO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxRQUNkLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
