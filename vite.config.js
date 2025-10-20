import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em vite.config.js

// CONFIGURAÇÃO ANTIGA:
// server: {
//   proxy: {
//     '/api': {
//       target: 'http://localhost:5173',
//       changeOrigin: true,
//     }
//   }
// }

// CONFIGURAÇÃO NOVA:
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Mude aqui
        changeOrigin: true,
      }
    }
  }
})