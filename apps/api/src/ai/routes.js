import { rateLimit } from 'express-rate-limit';
import { requireUser, requireRole, csrfProtection, failure } from '../auth/middleware.js';
import { readAiConfig, createGeminiExtractor } from './gemini.js';

export function installAiRoutes(app,config,{aiConfig=readAiConfig(),aiGenerateContent,aiLimit=5}={}) {
  const extract=createGeminiExtractor(aiConfig,{generateContent:aiGenerateContent});
  let inFlight=0;
  const limiter=rateLimit({windowMs:15*60*1000,limit:aiLimit,keyGenerator:req=>req.user.id,
    standardHeaders:'draft-8',legacyHeaders:false,
    handler:(_req,res)=>failure(res,429,'AI_RATE_LIMIT','Too many extraction attempts. Continue manually or wait before trying again.')});
  app.use('/api/rfq-extraction',requireUser,requireRole('estimator'));
  app.get('/api/rfq-extraction',(_req,res)=>res.json({provider:'Google Gemini',model:aiConfig.model,
    available:!aiConfig.unavailableCode && !!aiConfig.apiKey,code:aiConfig.unavailableCode || null,maxSourceCharacters:12000}));
  app.post('/api/rfq-extraction',csrfProtection(config.appOrigin),limiter,async(req,res)=>{
    if(inFlight>=2) return failure(res,429,'AI_BUSY','Extraction is busy. Continue manually or try again shortly.');
    const controller=new AbortController();
    const disconnected=()=>{if(!res.writableEnded) controller.abort();};
    res.on('close',disconnected);inFlight++;
    try {const result=await extract(req.body,{signal:controller.signal});if(!res.destroyed) res.json(result);}
    finally {inFlight--;res.off('close',disconnected);}
  });
}
