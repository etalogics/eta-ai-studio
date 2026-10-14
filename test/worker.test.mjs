import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../db/store.mjs';
import { processProviderJob } from '../worker/worker.mjs';
import { KLING_ENDPOINT } from '../lib/higgsfield/adapter.mjs';
const id='00000000-0000-4000-8000-000000000001';
function setup(state='pending',confirmed=true){
  const directory=mkdtempSync(path.join(tmpdir(),'studio-worker-'));const store=openStore(process.cwd(),directory);
  store.db.prepare('INSERT INTO assets VALUES(?,?,?,?)').run('reference','test.png','image/png','test.png');writeFileSync(path.join(directory,'references/test.png'),Buffer.from('synthetic reference'));
  store.db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run(id,'stable-submission-token',Date.now(),JSON.stringify({model:KLING_ENDPOINT,references:['reference'],prompt:'A slow push',duration:5,ratio:'from-image',confirmPaid:confirmed}));
  store.db.prepare('INSERT INTO provider_jobs(job_id,state) VALUES(?,?)').run(id,state);
  return {...store,directory,job:()=>store.db.prepare('SELECT jobs.*,provider_jobs.* FROM jobs JOIN provider_jobs ON jobs.id=job_id WHERE jobs.id=?').get(id),cleanup:()=>{store.db.close();rmSync(directory,{recursive:true,force:true});}};
}
test('live worker persists provider identity and resumes downloads without submitting twice',async()=>{
  const store=setup();let submissions=0;const requestId='00000000-0000-4000-8000-000000000002';
  const client={upload:async()=> 'https://fixture.cloudfront.net/ref.png',submit:async()=>{submissions++;return {request_id:requestId,status_url:`https://api.higgsfield.ai/requests/${requestId}/status`};},status:async()=>({status:'completed',video:{url:'https://fixture.cloudfront.net/output.mp4'}}),download:async(_url,directory,jobId)=>{writeFileSync(path.join(directory,jobId+'.mp4'),Buffer.from('synthetic fixture'));}};
  const config={credential:'fake',liveEnabled:true,approvedModel:KLING_ENDPOINT};
  try{await processProviderJob(store.db,store.data,store.job(),config,client);assert.equal(store.job().request_id,requestId);assert.equal(store.job().state,'queued');await processProviderJob(store.db,store.data,store.job(),config,client);assert.equal(store.job().state,'completed');assert.equal(submissions,1);}finally{store.cleanup();}
});
test('live worker will not retry an ambiguous submission or bypass paid consent',async()=>{
  const config={credential:'fake',liveEnabled:true,approvedModel:KLING_ENDPOINT};const client=new Proxy({}, {get(){throw new Error('No provider calls should be made.');}});
  const unknown=setup('submitting');try{await processProviderJob(unknown.db,unknown.data,unknown.job(),config,client);assert.equal(unknown.job().state,'unknown');}finally{unknown.cleanup();}
  const noConsent=setup('pending',false);try{await processProviderJob(noConsent.db,noConsent.data,noConsent.job(),config,client);assert.equal(noConsent.job().state,'failed');}finally{noConsent.cleanup();}
});
