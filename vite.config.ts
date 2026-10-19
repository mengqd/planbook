import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri 在开发模式下会从 http://localhost:5173 加载前端
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
})
