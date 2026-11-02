import { readConfig } from './config.js';

export function readMaintenanceUrl(env = process.env) {
  const runtime = new URL(readConfig(env).databaseUrl);
  let maintenance;
  try { maintenance = new URL(env.MIGRATION_DATABASE_URL); } catch { throw Error('MIGRATION_DATABASE_URL is required for migrations and seeds; runtime fallback is forbidden'); }
  if (!['postgres:', 'postgresql:'].includes(maintenance.protocol)) throw Error('MIGRATION_DATABASE_URL must be a PostgreSQL URL');
  if (runtime.hostname !== maintenance.hostname || (runtime.port || '5432') !== (maintenance.port || '5432') || runtime.pathname !== maintenance.pathname) throw Error('Maintenance connection must target the same host, port and database as DATABASE_URL');
  if (!maintenance.username || maintenance.username === runtime.username) throw Error('Maintenance and runtime database roles must differ');
  return maintenance.href;
}
