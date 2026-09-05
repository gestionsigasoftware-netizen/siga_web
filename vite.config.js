import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // strictPort: falla en vez de derivar en silencio a otro puerto --
  // varias rondas de QA de esta sesion dejaron procesos node huerfanos
  // ocupando 5174+ que hicieron pensar que un servidor mal levantado
  // "funcionaba" cuando en realidad estaba en el puerto equivocado.
  server: { port: 5173, strictPort: true, open: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
