const statuses = {
  AUTH_REQUIRED: 401, ROLE_FORBIDDEN: 403, INVALID_QUOTATION_INPUT: 400, INVALID_COSTING_INPUT: 400,
  RFQ_NOT_FOUND: 404, ROUTING_NOT_FOUND: 404, QUOTATION_NOT_FOUND: 404,
  SUBMISSION_CONFLICT: 409, RATE_NOT_FOUND: 422, UNSUPPORTED_RFQ: 422,
  INVALID_RFQ_INPUT: 400, RFQ_REFERENCE_CONFLICT: 409,
  AI_INVALID_INPUT:400, AI_SOURCE_INSTRUCTIONS:422, AI_NOT_CONFIGURED:503, AI_CONFIGURATION_INVALID:503,
  AI_TIMEOUT:504, AI_CANCELLED:408, AI_QUOTA_EXCEEDED:429, AI_MODEL_UNAVAILABLE:503,
  AI_PROVIDER_REQUEST:502, AI_PROVIDER_BILLING:503, AI_PROVIDER_PRECONDITION:503,
  AI_PROVIDER_ACCESS:503, AI_PROVIDER_UNAVAILABLE:503, AI_INVALID_RESPONSE:502
};
export function apiErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  res.set('Cache-Control', 'no-store');
  if (statuses[error.code]) {res.locals.errorCode=error.code;return res.status(statuses[error.code]).json({ error: {
    code: error.code, message: error.message, ...(error.field ? { field: error.field } : {})
  } });}
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 503;
  const ai = req.path === '/api/rfq-extraction';
  const intake = req.path === '/api/rfq-rate-keys' || (req.path === '/api/rfqs' && req.method === 'POST');
  const business = /^\/api\/(rfqs|quote-versions)(\/|$)/.test(req.path);
  const code = status === 413 ? 'REQUEST_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : ai ? 'AI_PROVIDER_UNAVAILABLE' : intake ? 'RFQ_SERVICE_UNAVAILABLE' : business ? 'QUOTATION_SERVICE_UNAVAILABLE' : 'AUTH_SERVICE_UNAVAILABLE';
  res.locals.errorCode=code;
  res.status(status).json({ error: { code, message: status === 503
    ? ai ? 'AI extraction unavailable. Continue manually.' : intake ? 'RFQ service unavailable. If saving, retry the same submission key and inputs to check the outcome.' : business ? 'Quotation service unavailable. If saving, retry the same submission key and inputs to check the outcome.' : 'Authentication service unavailable. Please retry.'
    : 'Invalid request body.' } });
}
