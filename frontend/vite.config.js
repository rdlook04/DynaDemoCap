import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// host: true => Vite escucha en 0.0.0.0 (expuesto a la red automáticamente).
// Inyectamos solo los PUERTOS; el frontend arma la URL con el host por el que
// se abrió la página (window.location.hostname), así sirve para todos sin IPs fijas.
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: Number(process.env.FRONTEND_PORT) || 5173,
    strictPort: true,
  },
  define: {
    __SIM_PORT__: JSON.stringify(Number(process.env.SIM_PORT) || 4001),
    __PER_PORT__: JSON.stringify(Number(process.env.PERSIST_PORT) || 4002),
  },
});
