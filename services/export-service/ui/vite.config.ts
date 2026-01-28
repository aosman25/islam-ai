import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/health': 'http://localhost:4000',
      '/ready': 'http://localhost:4000',
      '/categories': 'http://localhost:4000',
      '/authors': 'http://localhost:4000',
      '/books': 'http://localhost:4000',
      '/export': 'http://localhost:4000',
      '/jobs': 'http://localhost:4000',
      '/download': 'http://localhost:4000',
    },
  },
})
