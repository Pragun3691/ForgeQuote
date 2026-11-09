// Process-start mode only. No request header, query, cookie or bypass token can
// change it. This middleware is installed instead of the application writers.
export function maintenanceHeaders(res){
  return res.set({'Cache-Control':'no-store','Retry-After':'60'});
}

const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maintenance | ForgeQuote</title>
<style>html{color-scheme:dark}body{margin:0;background:#171717;color:#FAF8F3;font:1rem/1.65 system-ui,sans-serif}main{max-width:42rem;margin:12vh auto;padding:2rem}header{font-weight:750;font-size:1.5rem;border-left:4px solid #A31C1B;padding-left:1rem}h1{font-size:clamp(2rem,6vw,3rem);line-height:1.15}aside{background:#06110C;border:1px solid #526359;padding:1.25rem}a{color:#FAF8F3;text-underline-offset:.25em}a:focus-visible{outline:3px solid #FAF8F3;outline-offset:5px}</style></head>
<body><main><header>ForgeQuote</header><h1>Temporarily in maintenance</h1><p>Quotation workflows are temporarily unavailable. Please try again after the maintenance window.</p><aside>Keep existing work tabs open. Preserve any pending submission key and its inputs; do not create a replacement submission when an earlier outcome is uncertain.</aside><p><a href="/">Check again</a></p></main></body></html>`;

export function maintenanceResponse(req,res){
  maintenanceHeaders(res);
  res.locals.errorCode='MAINTENANCE';
  if(/^\/api(?:\/|$)/i.test(req.path))return res.status(503).json({error:{code:'MAINTENANCE',message:'ForgeQuote is in maintenance. Keep pending submission keys and inputs; retry after the maintenance window.'}});
  return res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'").status(503).type('html').send(page);
}
