import { rateLimit } from 'express-rate-limit';
import { addRateVersion, businessDate } from './final-workflows.js';
import { validateDate, inputError } from './quotation-request.js';
import { transaction } from './db.js';
import { requireUser, requireRole, csrfProtection, failure } from './auth/middleware.js';



export async function rateCatalogue(pool,actorId,asOf=businessDate()) {
  asOf=validateDate(asOf);
  return transaction(pool,async client=>{
    const user=(await client.query('SELECT role,active FROM users WHERE id=$1',[actorId])).rows[0];
    if(!user?.active) throw inputError('Sign in to continue.','AUTH_REQUIRED');
    if(!['estimator','sales_head'].includes(user.role)) throw inputError('Rate access is not permitted.','ROLE_FORBIDDEN');
    // One statement snapshot for all keys and derived start-inclusive/end-exclusive periods.
    // Cast NUMERIC to text before JSON construction; never lose decimal precision.
    const keys=(await client.query(`SELECT k.id,k.code,k.category,k.unit,
      COALESCE(jsonb_agg(jsonb_build_object('id',v.id,'value',v.value::text,
        'effectiveFrom',v.effective_from::text,'effectiveTo',v.effective_to::text,'createdAt',r.created_at,'actorId',r.actor_user_id,'reason',r.reason)
        ORDER BY v.effective_from DESC) FILTER (WHERE v.id IS NOT NULL),'[]') AS versions
      FROM rate_keys k LEFT JOIN rate_periods v ON v.rate_key_id=k.id
      LEFT JOIN rate_versions r ON r.id=v.id GROUP BY k.id ORDER BY k.category,k.code`)).rows;
    return {asOf,canWrite:user.role==='sales_head',businessDate:businessDate(),rateKeys:keys.map(key=>({...key,currentVersion:key.versions.find(v=>v.effectiveFrom<=asOf && (v.effectiveTo===null || asOf<v.effectiveTo)) || null}))};
  });
}

export function installRateRoutes(app,pool,config) {
  app.use('/api/rates',requireUser);
  app.get('/api/rates',async(req,res)=>{
    if(Object.keys(req.query).some(key=>key!=='asOf')) throw inputError('Only the asOf date query is supported.');
    res.json(await rateCatalogue(pool,req.user.id,req.query.asOf));
  });
  app.post('/api/rates/:id/versions',requireRole('sales_head'),csrfProtection(config.appOrigin),
    rateLimit({windowMs:15*60*1000,limit:30,keyGenerator:req=>req.user.id,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{
      const result=await addRateVersion(pool,req.user.id,req.params.id,req.get('Idempotency-Key'),req.body);
      res.status(result.replayed?200:201).json(result);
    });
  // No key creation, replacement or deletion endpoint.
  for(const method of ['post','put','patch','delete']) app[method](['/api/rates','/api/rates/{*path}'],csrfProtection(config.appOrigin),(_req,res)=>
    failure(res,403,'RATE_WRITE_FORBIDDEN','Only Sales Head may append versions through the dedicated authoring endpoint.'));
}
