import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

const EXCEL_SOURCE = 'D:/OneDrive - Quadratic Insights Pvt Ltd/AskQ/AskQ_Master_Dashboard.xlsx';
const EXCEL_SERVE_PATH = '/AskQ_Master_Dashboard.xlsx';

// Standalone PowerBI_Flat_Table — this is the file PBI uses; has correct issue counts
const FT_SOURCE = 'D:/OneDrive - Quadratic Insights Pvt Ltd/PowerBI_Flat_Table.xlsx';
const FT_SERVE_PATH = '/PowerBI_Flat_Table.xlsx';

function serveFile(source, res) {
  try {
    const data = fs.readFileSync(source);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(data);
  } catch (e) {
    res.statusCode = 404;
    res.end(`File not found at: ${source}`);
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-onedrive-excel',
      configureServer(server) {
        server.middlewares.use(EXCEL_SERVE_PATH, (_req, res) => serveFile(EXCEL_SOURCE, res));
        server.middlewares.use(FT_SERVE_PATH,    (_req, res) => serveFile(FT_SOURCE, res));
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
