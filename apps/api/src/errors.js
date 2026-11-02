const statuses = {
  AUTH_REQUIRED: 401, ROLE_FORBIDDEN: 403, INVALID_QUOTATION_INPUT: 400, INVALID_COSTING_INPUT: 400,
  RFQ_NOT_FOUND: 404, ROUTING_NOT_FOUND: 404, QUOTATION_NOT_FOUND: 404,
  SUBMISSION_CONFLICT: 409, RATE_NOT_FOUND: 422, UNSUPPORTED_RFQ: 422
};
export function apiErrorHandler(error, req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (res.headersSent) return next(error);
  if (statuses[error.code]) return res.status(statuses[error.code]).json({ error: {
    code: error.code, message: error.message, ...(error.field ? { field: error.field } : {})
  } });
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 503;
  const business = /^\/api\/(rfqs|quote-versions)(\/|$)/.test(req.path);
  const code = status === 413 ? 'REQUEST_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : business ? 'QUOTATION_SERVICE_UNAVAILABLE' : 'AUTH_SERVICE_UNAVAILABLE';
  res.status(status).json({ error: { code, message: status === 503
    ? business ? 'Quotation service unavailable. If saving, retry the same submission key and inputs to check the outcome.' : 'Authentication service unavailable. Please retry.'
    : 'Invalid request body.' } });
}
