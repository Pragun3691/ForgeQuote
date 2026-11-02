import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export default defineConfig(() => {
  // Read only the API port; Vite loadEnv on the server's .env also overrides build NODE_ENV.
  const path = new URL('../../.env', import.meta.url);
  const env = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
  return { server: { proxy: { '/api': `http://127.0.0.1:${process.env.PORT || env.PORT || '3000'}` } } };
});
