// Only these identifiers may leave the provider boundary. Never serialize errors.
const providerReasons = ['API_KEY_INVALID','API_KEY_EXPIRED','API_KEY_SERVICE_BLOCKED','API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED','SERVICE_DISABLED','BILLING_DISABLED','BILLING_NOT_ACTIVE','BILLING_NOT_ENABLED','BILLING_ACCOUNT_DISABLED','BILLING_ACCOUNT_CLOSED'];
const providerStatuses = ['INVALID_ARGUMENT','UNAUTHENTICATED','PERMISSION_DENIED','NOT_FOUND','RESOURCE_EXHAUSTED','FAILED_PRECONDITION','INTERNAL','UNAVAILABLE','DEADLINE_EXCEEDED'];
const transportCodes = ['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET'];
const categories = ['SUCCESS','INVALID_RESPONSE','PROVIDER_HTTP','NETWORK_TRANSPORT','APPLICATION_DEADLINE','CLIENT_CANCELLATION','INTERNAL_EXCEPTION'];
const allowed = (values,value) => values.includes(value) ? value : 'OTHER';
export function providerFacts(error) {
  const numericStatus=Number(error?.status);
  const upstreamStatus=Number.isInteger(numericStatus) && numericStatus>=400 && numericStatus<=599 ? numericStatus : null;
  let detail;
  try {detail=JSON.parse(error?.message)?.error;} catch { /* Raw text stays private. */ }
  const reasons=Array.isArray(detail?.details) ? detail.details.map(item=>item?.reason) : [];
  const providerReason=reasons.find(reason=>providerReasons.includes(reason)) || 'OTHER';
  const transportCode=[error?.code,error?.cause?.code].find(code=>transportCodes.includes(code)) || 'OTHER';
  return {upstreamStatus,providerReason,providerStatus:allowed(providerStatuses,detail?.status),transportCode,
    invalidKey:reasons.includes('API_KEY_INVALID')};
}
export function providerCategory(error,facts) {
  if(facts.upstreamStatus!==null) return 'PROVIDER_HTTP';
  // TypeError is the existing fetch-failure/retry boundary; a known cause adds detail.
  if(error instanceof TypeError || facts.transportCode!=='OTHER') return 'NETWORK_TRANSPORT';
  return 'INTERNAL_EXCEPTION';
}
export function providerAttemptEvent(data) {
  return {event:'ai_provider_attempt',
    attempt:[1,2].includes(data.attempt)?data.attempt:0,
    durationMs:Number.isFinite(data.durationMs)?Math.max(0,Math.round(data.durationMs)):0,
    upstreamStatus:Number.isInteger(data.upstreamStatus) && data.upstreamStatus>=400 && data.upstreamStatus<=599?data.upstreamStatus:null,
    category:allowed(categories,data.category),
    providerReason:allowed(providerReasons,data.providerReason),
    providerStatus:allowed(providerStatuses,data.providerStatus),
    transportCode:allowed(transportCodes,data.transportCode),
    deadlineExpired:data.deadlineExpired===true,cancelled:data.cancelled===true};
}
