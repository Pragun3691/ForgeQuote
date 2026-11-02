import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { json } from 'express';
import { hashPassword, verifyPassword } from './passwords.js';
import { csrfToken, csrfProtection, destroySession, saveSession, regenerateSession, loadUser, requireUser, failure } from './middleware.js';

const PgStore = connectPgSimple(session);
// Same scrypt work for unknown users. Generated per process; never a usable identity.
const dummyHash = hashPassword(randomBytes(32).toString('hex'));
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function installAuth(app, pool, config, { sessionSchema = 'public', loginLimit = 10 } = {}) {
  if (config.trustProxyHops) app.set('trust proxy', config.trustProxyHops);
  const cookieName = config.nodeEnv === 'production' ? '__Host-forgequote.sid' : 'forgequote.sid';
  const cookieOptions = { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/' };
  const clearCookie = res => res.clearCookie(cookieName, cookieOptions);
  const store = new PgStore({ pool, schemaName: sessionSchema, tableName: 'sessions', createTableIfMissing: false, disableTouch: true, pruneSessionInterval: 15 * 60, errorLog: () => console.error('Session store operation failed') });
  app.locals.sessionStore = store;
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: loginLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => failure(res, 429, 'LOGIN_RATE_LIMIT', 'Too many login attempts. Try again in 15 minutes.')
  });
  // Apply before session lookup/hash work, including malformed/CSRF-invalid login attempts.
  app.use('/api/auth/login', limiter);
  const ordinaryJson = json({ limit: '4kb', strict: true });
  const intakeJson = json({ limit: '64kb', strict: true });
  app.use('/api', (req,res,next) => (req.method === 'POST' && req.path === '/rfqs' ? intakeJson : ordinaryJson)(req,res,next));
  app.use('/api', session({
    name: cookieName, secret: config.sessionSecret, store, resave: false, saveUninitialized: false, rolling: false,
    cookie: { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS }
  }));
  app.use('/api', loadUser(pool, clearCookie));
  const csrf = csrfProtection(config.appOrigin);

  app.get('/api/auth/session', async (req, res) => {
    // loadUser regenerates expired/disabled sessions as anonymous sessions.
    if (!req.session.csrfToken) { req.session.csrfToken = csrfToken(); await saveSession(req); }
    res.json({ user: req.user, csrfToken: req.session.csrfToken });
  });

  app.post('/api/auth/login', csrf, async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'password,username' || typeof body.username !== 'string' || !/^[a-z_]{1,32}$/.test(body.username) || typeof body.password !== 'string' || Buffer.byteLength(body.password, 'utf8') > 256) {
      return failure(res, 400, 'INVALID_LOGIN_INPUT', 'Provide username and password strings.');
    }
    const result = await pool.query('SELECT id,username,password_hash,role,active FROM users WHERE username=$1', [body.username]);
    const user = result.rows[0];
    const valid = await verifyPassword(body.password, user?.password_hash ?? await dummyHash);
    if (!valid || !user?.active) return failure(res, 401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.expiresAt = Date.now() + SESSION_MAX_AGE_MS;
    req.session.csrfToken = csrfToken();
    req.session.cookie.maxAge = SESSION_MAX_AGE_MS;
    await saveSession(req);
    res.json({ user: { id: user.id, username: user.username, role: user.role }, csrfToken: req.session.csrfToken });
  });

  app.post('/api/auth/logout', requireUser, csrf, async (req, res) => {
    await destroySession(req); clearCookie(res); res.sendStatus(204);
  });

}
