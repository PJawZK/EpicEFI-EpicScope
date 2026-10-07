import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const shimTarget = env.EPICSCOPE_SHIM_TARGET || 'http://127.0.0.1:29002';

  return {
    root: 'apps/web',
    base: '/EpicEFI-EpicScope/',
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/telemetry': {
          target: shimTarget,
          ws: true,
          changeOrigin: true,
          rewriteWsOrigin: true,
        },
        '/api/v1': {
          target: shimTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: '../../dist/web',
      emptyOutDir: true,
    },
  };
});
