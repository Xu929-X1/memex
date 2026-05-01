import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['cookies', 'storage'],
    host_permissions: [
      'http://localhost:3001/*',
      'https://memex.up.railway.app/*',
    ],
  },
  dev: { server: { port: 5173 } },
});
