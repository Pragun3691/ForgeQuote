import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { databasePoolConfig } from './database-config.js';

// Resolve from this module, independent of npm workspace's working directory.
const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (process.env.NODE_ENV !== 'production' && existsSync(envPath)) process.loadEnvFile(envPath);

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
  if (env.MAINTENANCE_MODE !== undefined && !['true','false'].includes(env.MAINTENANCE_MODE)) throw new Error('MAINTENANCE_MODE must be exactly true or false');
  const maintenanceMode = env.MAINTENANCE_MODE === 'true';
  const gst = env.DEMO_GST_PERCENT ?? '18';
  if (gst !== '18') throw new Error('T01 uses explicitly illustrative DEMO_GST_PERCENT=18');
  const databaseTlsMode = env.DATABASE_TLS_MODE;
  const databaseCaCert = env.DATABASE_CA_CERT;
  databasePoolConfig(databaseUrl, {nodeEnv, databaseTlsMode, databaseCaCert, globalTlsVerification:env.NODE_TLS_REJECT_UNAUTHORIZED});
  return { databaseUrl, port: Number(portText), nodeEnv, gstPercent: gst, databaseTlsMode, databaseCaCert, maintenanceMode };
}

export function readAuthConfig(env = process.env) {
  const base = readConfig(env);
  if(base.nodeEnv==='production' && [env.MIGRATION_DATABASE_URL,env.TEST_DATABASE_URL,env.DEMO_ESTIMATOR_PASSWORD,env.DEMO_SALES_HEAD_PASSWORD].some(Boolean)) throw Error('Maintenance, test and seed credentials must not be present in the production app environment');
  if (typeof env.SESSION_SECRET !== 'string' || Buffer.byteLength(env.SESSION_SECRET) < 32) throw Error('SESSION_SECRET must contain at least 32 bytes');
  let origin;
  try { origin = new URL(env.APP_ORIGIN); } catch { throw Error('APP_ORIGIN must be an explicit HTTP(S) origin'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== env.APP_ORIGIN || origin.username || origin.password || (base.nodeEnv === 'production' && origin.protocol !== 'https:')) throw Error('APP_ORIGIN must be an origin without a path; production requires HTTPS');
  const hops = env.TRUST_PROXY_HOPS ?? '0';
  if (!['0', '1'].includes(hops)) throw Error('TRUST_PROXY_HOPS must be 0 or 1');
  return { ...base, sessionSecret: env.SESSION_SECRET, appOrigin: origin.origin, trustProxyHops: Number(hops) };
}
