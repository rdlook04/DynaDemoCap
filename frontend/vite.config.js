import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Las URLs de los servicios se inyectan desde las variables de entorno
// exportadas por los scripts de arranque (start.sh / start.ps1).
export default defineConfig({
  plugins: [vue()],
  server: {
    port: Number(process.env.FRONTEND_PORT) || 5173,
    strictPort: true,
  },
  define: {
    __SIM_URL__: JSON.stringify(process.env.VITE_SIM_URL || 'http://localhost:4001'),
    __PER_URL__: JSON.stringify(process.env.VITE_PER_URL || 'http://localhost:4002'),
  },
});
