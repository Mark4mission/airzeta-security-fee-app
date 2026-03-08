import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel 배포: base는 '/' (루트)
  base: '/',
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    strictPort: false,
    allowedHosts: [
      '.sandbox.novita.ai',
      'localhost',
    ],
  },
  build: {
    // Use esbuild for faster minification (less memory than terser)
    minify: 'esbuild',
    // Split large chunks to reduce memory pressure during build
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/app-check'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
        }
      }
    }
  }
})
