import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  output: 'server',
  devToolbar: {
    enabled: false,
  },
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [react()],
  vite: {
    envDir: rootDir,
  },
  server: {
    port: 4321,
  },
});
