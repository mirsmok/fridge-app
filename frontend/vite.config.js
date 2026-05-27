import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const certFile = resolve(__dirname, 'cert.pem');
const keyFile  = resolve(__dirname, 'cert-key.pem');
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: hasCerts
      ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
      : true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
