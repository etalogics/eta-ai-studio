import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openStore } from '../db/store.mjs';
import { readProviderConfig } from '../provider-config.mjs';
import { createHiggsfieldClient, KLING_ENDPOINT } from '../lib/higgsfield/adapter.mjs';

export async function processProviderJob(db,data,job,config,client) {
  const settings=JSON.parse(job.settings);
  const update=(state,error=null,nextPoll=Date.now()+5000)=>db.prepare('UPDATE provider_jobs SET state=?,error=?,next_poll=?,lease_until=0,lease_owner=NULL WHERE job_id=?').run(state,error,nextPoll,job.id);
  if(!job.request_id && job.state==='submitting'){update('unknown','Submission status unknown. Do not regenerate automatically; reconcile the provider request first.');return;}
  if(!job.request_id){
    if(settings.model!==KLING_ENDPOINT){update('failed','The queued provider job has an unsupported model. No request was sent.');return;}
    if(config.provider && config.provider!=='higgsfield' || !config.liveEnabled || config.approvedModel!==KLING_ENDPOINT || !config.credential){update('pending','Live generation is disabled. Existing unsent jobs are waiting for configuration.');return;}
    if(settings.confirmPaid!==true){update('failed','Explicit paid-generation approval is missing.');return;}
    let submitting=false;
    try{
      db.prepare("UPDATE provider_jobs SET state='uploading' WHERE job_id=?").run(job.id);
      const asset=db.prepare('SELECT * FROM assets WHERE id=?').get(settings.references[0]);if(!asset)throw new Error('Start frame is missing.');
      const url=await client.upload(readFileSync(path.join(data,'references',asset.stored)),asset.mime);
      db.prepare("UPDATE provider_jobs SET state='submitting' WHERE job_id=?").run(job.id);
      submitting=true;
      let result;
      try{result=await client.submit(settings,url,job.token);}catch(error){update(error.httpStatus>=400 && error.httpStatus<500?'failed':'unknown',error.httpStatus>=400 && error.httpStatus<500?error.message:'Submission status unknown. The provider may have accepted the request; no automatic generation retry will occur.');return;}
      db.prepare("UPDATE provider_jobs SET request_id=?,status_url=?,state='queued',next_poll=?,lease_until=0,lease_owner=NULL,error=NULL WHERE job_id=?").run(result.request_id,result.status_url,Date.now()+3000,job.id);return;
    }catch{update(submitting?'unknown':'failed',submitting?'Submission may have been accepted but its local record could not be saved. Reconcile in the provider console; no automatic generation retry will occur.':'Reference upload or preparation failed. No generation was submitted. Check provider credentials, storage hosts, and the reference file.');return;}
  }
  try{
    const result=await client.status(job.status_url,job.request_id);
    if(['failed','nsfw','canceled'].includes(result.status)){update('failed',`Provider ended this request as ${result.status}. Check the provider console; no regeneration was submitted.`);return;}
    if(result.status==='completed'){
      if(!result.video?.url)throw new Error('Completed provider response has no video.');
      db.prepare("UPDATE provider_jobs SET state='downloading' WHERE job_id=?").run(job.id);
      await client.download(result.video.url,path.join(data,'outputs'),job.id);update('completed');return;
    }
    update(result.status==='queued'?'queued':'processing',null,Date.now()+Math.min(60000,5000*Math.max(1,job.attempts)));
  }catch{update('processing','Status or output retrieval failed. The saved provider job will be checked again without another generation.',Date.now()+60000);}
}
export function startWorker(root=process.cwd()) {
  const {db,data}=openStore(root);const owner=randomUUID();let busy=false;let stopped=false;
  const tick=async()=>{
    if(busy||stopped)return;busy=true;
    try{
      const rows=db.prepare("SELECT jobs.*,provider_jobs.* FROM provider_jobs JOIN jobs ON jobs.id=provider_jobs.job_id WHERE provider_jobs.state NOT IN ('completed','failed','unknown') AND next_poll<=? AND lease_until<=? LIMIT 10").all(Date.now(),Date.now());
      for(const job of rows){if(stopped)break;const claimed=db.prepare('UPDATE provider_jobs SET lease_owner=?,lease_until=?,attempts=attempts+1 WHERE job_id=? AND lease_until<=?').run(owner,Date.now()+300000,job.id,Date.now());if(!claimed.changes)continue;const config=readProviderConfig();await processProviderJob(db,data,job,config,createHiggsfieldClient(config));}
    }finally{busy=false;}
  };
  const timer=setInterval(()=>{tick().catch(()=>{});},2000);timer.unref();
  return async()=>{stopped=true;clearInterval(timer);while(busy)await new Promise(resolve=>setTimeout(resolve,100));db.close();};
}
