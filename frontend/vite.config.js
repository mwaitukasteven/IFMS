// Vite configuration for Patrick's React frontend.
//
// - Runs on port 3000 (matches CORS_ALLOWED_ORIGINS in the Django backend's .env).
// - Proxies /api requests to the Django backend at http://localhost:8000
//   during development. This lets us call `axios.get('/api/assets/')` in code
//   without hardcoding the backend URL or fighting CORS in dev.
// - Builds production assets into dist/ (served by any static host).

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Anything starting with /api goes to Django on port 8000
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Static media (uploaded asset images) also lives on the Django server
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
