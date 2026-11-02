import { randomBytes, timingSafeEqual } from 'node:crypto';

export function failure(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export const csrfToken = () => randomBytes(32).toString('hex');
export const destroySession = req => new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
export const saveSession = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
export const regenerateSession = req => new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));

export function csrfProtection(origin) {
  return (req, res, next) => {
    const supplied = req.get('X-CSRF-Token');
    const expected = req.session?.csrfToken;
    if (req.get('Origin') !== origin || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) || typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return failure(res, 403, 'CSRF_INVALID', 'Refresh the session and retry with a valid CSRF token and origin.');
    }
    next();
  };
}

export function loadUser(pool, clearCookie) {
  return async (req, res, next) => {
    req.user = null;
    if (!req.session.userId) return next();
    if (!Number.isFinite(req.session.expiresAt) || req.session.expiresAt <= Date.now()) {
      await regenerateSession(req); clearCookie(res); return next();
    }
    const result = await pool.query('SELECT id,username,role,active FROM users WHERE id=$1', [req.session.userId]);
    const user = result.rows[0];
    if (!user?.active) { await regenerateSession(req); clearCookie(res); return next(); }
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  };
}

export function requireUser(req, res, next) {
  if (!req.user) return failure(res, 401, 'AUTH_REQUIRED', 'Sign in to continue.');
  next();
}

export function requireRole(role) {
  return (req, res, next) => req.user?.role === role ? next() : failure(res, 403, 'ROLE_FORBIDDEN', 'Your role cannot perform this action.');
}
