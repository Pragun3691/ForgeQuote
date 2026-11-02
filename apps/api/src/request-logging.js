import { randomUUID } from 'node:crypto';

// Allowlist-only logging: never serialize req/res/error objects, raw URLs,
// headers, IPs, actor names, bodies, query strings, tokens or database messages.
export function requestLogging({enabled = false, write = line => console.log(line)} = {}) {
  return (req,res,next) => {
    if(!enabled) return next();
    const requestId=randomUUID(), started=performance.now();
    res.set('X-Request-Id',requestId);
    res.on('finish',()=>{
      if(req.route?.path === '/api/health/live' && res.statusCode === 200) return;
      const event={event:'http_request',requestId,
        method:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method)?req.method:'OTHER',
        route:req.route?.path || '/unmatched',status:res.statusCode,
        durationMs:Math.round(performance.now()-started),
        ...(res.locals.errorCode ? {errorCode:res.locals.errorCode} : {})};
      try {write(JSON.stringify(event));} catch { /* logging failure must not replay a successful write */ }
    });
    next();
  };
}
