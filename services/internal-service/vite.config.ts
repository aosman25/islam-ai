import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const isDocker = process.env.DOCKER_ENV === 'true'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api/gateway': {
        target: isDocker ? 'http://gateway:8000' : 'http://localhost:8100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gateway/, ''),
      },
      '/api/ask': {
        target: isDocker ? 'http://ask-service:2000' : 'http://localhost:2000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ask/, ''),
      },
      '/api/search': {
        target: isDocker ? 'http://search-service:3000' : 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search/, ''),
      },
      '/api/embed': {
        target: isDocker ? 'http://embed-service:4000' : 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/embed/, ''),
      },
      '/api/query-optimizer': {
        target: isDocker ? 'http://query-optimizer:5000' : 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/query-optimizer/, ''),
      },
      '/api/master': {
        target: isDocker ? 'http://master-server:3000' : 'http://localhost:8200',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/master/, ''),
      },
    },
  },
})
