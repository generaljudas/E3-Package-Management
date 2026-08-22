import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' so the built app also works from the filesystem (Electron loads
// frontend/dist via file://). PWA/service-worker support is on the roadmap.
export default defineConfig({
  base: './',
  plugins: [react()],
})
