import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
      binaryInterval: 300
    },
    hmr: {
      overlay: true
    }
  },
  optimizeDeps: {
    exclude: ['fsevents']
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
