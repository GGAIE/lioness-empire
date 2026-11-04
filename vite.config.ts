import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
// Content remains external JSON in both development and the static build.
export default defineConfig(({ mode }) => ({
  root: 'apps/web-vn',
  base: './',
  plugins: [react()],
  publicDir: mode === 'pages' ? false : resolve('apps/web-vn/public'),
  build: { outDir: resolve(mode === 'pages' ? 'github-pages' : 'dist'), emptyOutDir: true },
  server: { fs: { allow: [resolve('.')] } },
}));
