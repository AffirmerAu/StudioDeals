import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// Vite 8 prefers import.meta.dirname over __dirname
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
})
