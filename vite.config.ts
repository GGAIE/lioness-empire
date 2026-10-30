import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
// Content remains external JSON in both development and the static build.
export default defineConfig({
  root: 'apps/web-vn',
  base: './',
  plugins: [react()],
  publicDir: resolve('apps/web-vn/public'),
  build: { outDir: resolve('dist'), emptyOutDir: true },
  server: { fs: { allow: [resolve('.')] } },
});
