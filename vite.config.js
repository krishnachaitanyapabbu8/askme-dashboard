import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

const EXCEL_SOURCE     = 'D:/OneDrive - Quadratic Insights Pvt Ltd/AskQ/AskQ_Master_Dashboard.xlsx';
const EXCEL_SERVE_PATH = '/AskQ_Master_Dashboard.xlsx';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-onedrive-excel',
      configureServer(server) {
        server.middlewares.use(EXCEL_SERVE_PATH, (_req, res) => {
          try {
            const data = fs.readFileSync(EXCEL_SOURCE);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.end(data);
          } catch (e) {
            res.statusCode = 404;
            res.end(`File not found at: ${EXCEL_SOURCE}`);
          }
        });
      },
    },
  ],
  base: './',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
