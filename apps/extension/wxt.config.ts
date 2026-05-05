import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['cookies', 'storage', 'bookmarks'],
    host_permissions: [
      'http://localhost:3001/*',
      'https://memex.up.railway.app/*',
    ],
  },
  dev: { server: { port: 5173 } },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }),
});
