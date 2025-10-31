import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/pda-app/', // necesario para GitHub Pages (usa el nombre del repo)
  plugins: [react()],
})
