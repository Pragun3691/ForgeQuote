// One TLS policy for runtime and maintenance pools. URL SSL options must never
// overwrite node-postgres's explicit certificate-verification configuration.
export function databasePoolConfig(connectionString, {
  nodeEnv = process.env.NODE_ENV ?? 'development',
  databaseTlsMode = process.env.DATABASE_TLS_MODE,
  databaseCaCert = process.env.DATABASE_CA_CERT,
  globalTlsVerification = process.env.NODE_TLS_REJECT_UNAUTHORIZED
} = {}) {
  let url;
  try {url = new URL(connectionString);} catch {throw Error('DATABASE_URL must be a PostgreSQL URL');}
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('DATABASE_URL must be a PostgreSQL URL');
  for (const key of ['ssl','sslcert','sslkey','sslrootcert','sslpassword','sslnegotiation','uselibpqcompat']) {
    if(url.searchParams.has(key)) throw Error('Unsupported database URL TLS option; use DATABASE_TLS_MODE and DATABASE_CA_CERT');
  }
  const urlMode = url.searchParams.get('sslmode');
  if (urlMode && !['require','verify-full','verify-ca','disable'].includes(urlMode)) throw Error('Unsupported database URL sslmode');
  const mode = databaseTlsMode ?? (urlMode && urlMode !== 'disable' ? 'verify-full' : nodeEnv === 'production' ? 'verify-full' : 'disable');
  if (!['disable','verify-full'].includes(mode)) throw Error('DATABASE_TLS_MODE must be disable or verify-full');
  if ((nodeEnv === 'production' && mode !== 'verify-full') || (mode === 'verify-full' && urlMode === 'disable') || (mode === 'disable' && urlMode && urlMode !== 'disable')) throw Error('Conflicting or insecure database TLS configuration');
  if (nodeEnv === 'production' && globalTlsVerification === '0') throw Error('Global TLS certificate verification must not be disabled');
  if (databaseCaCert && mode !== 'verify-full') throw Error('DATABASE_CA_CERT requires verify-full TLS');
  url.searchParams.delete('sslmode');
  return { connectionString: url.href,
    ssl: mode === 'verify-full' ? {rejectUnauthorized: true, minVersion: 'TLSv1.2', ...(databaseCaCert ? {ca:databaseCaCert} : {})} : false,
    max:5, connectionTimeoutMillis:5000, idleTimeoutMillis:10000 };
}
