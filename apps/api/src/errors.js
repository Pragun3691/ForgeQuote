export function apiErrorHandler(error, _req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 503;
  const code = status === 413 ? 'REQUEST_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : 'AUTH_SERVICE_UNAVAILABLE';
  res.status(status).json({ error: { code, message: status === 503 ? 'Authentication service unavailable. Please retry.' : 'Invalid request body.' } });
}
