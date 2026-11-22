import fs from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildSecurityHeaders } from './src/utils/csp';

const apiUrl = process.env.VITE_API_URL;
const devHeaders = buildSecurityHeaders({ apiUrl, isProduction: false });
const productionHeaders = buildSecurityHeaders({ apiUrl, isProduction: true });

/** Emit `_headers` for static hosts (Netlify / Cloudflare Pages) after each build. */
function staticHostHeaders(): Plugin {
  return {
    name: 'stockiq-static-security-headers',
    apply: 'build',
    writeBundle() {
      const outputDir = path.resolve(__dirname, 'dist');
      fs.mkdirSync(outputDir, { recursive: true });
      const lines = [
        '# Generated at build time. Do not edit by hand.',
        '/*',
        ...Object.entries(productionHeaders).map(([name, value]) => `  ${name}: ${value}`),
        '',
      ];
      fs.writeFileSync(path.join(outputDir, '_headers'), lines.join('\n'));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), staticHostHeaders()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    headers: devHeaders,
  },
  preview: {
    port: 4173,
    headers: productionHeaders,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-vendor')
          ) {
            return 'charts';
          }
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
