import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Resolve from this module, independent of npm workspace's working directory.
const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

export function readConfig(env = process.env) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  let parsed;
  try { parsed = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL URL');
  const portText = env.PORT ?? '3000';
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) throw new Error('PORT must be 1..65535');
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('Unsupported NODE_ENV');
  const gst = env.DEMO_GST_PERCENT ?? '18';
  if (gst !== '18') throw new Error('T01 uses explicitly illustrative DEMO_GST_PERCENT=18');
  return { databaseUrl, port: Number(portText), nodeEnv, gstPercent: gst };
}
