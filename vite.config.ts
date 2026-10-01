import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/web',
  base: '/EpicEFI-EpicScope/',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
});
