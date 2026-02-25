import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 배포: base는 '/airzeta-security-fee-app/'
  base: '/airzeta-security-fee-app/',
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    strictPort: false,
    allowedHosts: [
      '.sandbox.novita.ai',
      'localhost',
    ],
  }
})
