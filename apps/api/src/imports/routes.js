import { raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireUser,requireRole,csrfProtection,failure } from '../auth/middleware.js';
import { importXlsx } from './worker.js';
import { XLSX_MIME,MAX_UPLOAD } from './xlsx.js';

export function installImportRoutes(app,config,{xlsxImport=importXlsx,importLimit=5}={}) {
  let inFlight=0;
  const limiter=rateLimit({windowMs:15*60*1000,limit:importLimit,keyGenerator:req=>req.user.id,standardHeaders:'draft-8',legacyHeaders:false,
    handler:(_req,res)=>failure(res,429,'XLSX_RATE_LIMIT','Too many workbook attempts. Continue manually or wait before importing again.')});
  app.post('/api/rfq-import/xlsx',requireUser,requireRole('estimator'),csrfProtection(config.appOrigin),limiter,
    (req,res,next)=>{
      if(req.get('Content-Type')!==XLSX_MIME||!/^[a-zA-Z0-9_. -]{1,100}\.xlsx$/i.test(req.get('X-File-Name')||'')||req.get('Content-Encoding'))return failure(res,415,'XLSX_TYPE','Select an unencrypted .xlsx file in the documented template.');
      if(req.get('X-Synthetic-Only')!=='true')return failure(res,400,'XLSX_ATTESTATION','Confirm the workbook is entirely synthetic, nonconfidential and contains no real personal data.');
      if(inFlight>=2)return failure(res,429,'XLSX_BUSY','Workbook import is busy. Continue manually or try again shortly.');
      inFlight++;
      let released=false;
      const deadline=setTimeout(()=>{if(!res.destroyed){failure(res,504,'XLSX_TIMEOUT','Workbook upload or parsing timed out. No RFQ was saved.');req.destroy();}},15000);
      const release=()=>{if(!released){released=true;clearTimeout(deadline);inFlight--;}};
      res.once('close',release);res.once('finish',release);next();
    },raw({type:()=>true,limit:MAX_UPLOAD,inflate:false}),async(req,res)=>{
      const controller=new AbortController();
      const disconnected=()=>{if(!res.writableEnded)controller.abort();};
      res.once('close',disconnected);
      try {const result=await xlsxImport(req.body,{signal:controller.signal});if(!res.destroyed)res.json(result);}
      finally {res.off('close',disconnected);}
    });
}
