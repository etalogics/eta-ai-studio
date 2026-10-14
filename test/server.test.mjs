import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data=mkdtempSync(path.join(tmpdir(),'studio-test-'));
const port=14311;const base=`http://127.0.0.1:${port}`;
let child;
async function start(){child=spawn(process.execPath,['server.mjs','--production'],{cwd:root,env:{...process.env,PORT:String(port),STUDIO_DATA_DIR:data},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{if(b.toString().includes('SIMULATION ONLY'))resolve();});child.on('error',reject);child.on('exit',code=>reject(new Error(`Server exited ${code}`)));});}
async function stop(){const exited=once(child,'exit');child.kill();await exited;}
async function auth(){const res=await fetch(base);const cookie=res.headers.get('set-cookie').split(';')[0];const boot=await(await fetch(base+'/api/bootstrap',{headers:{cookie}})).json();return {cookie,csrf:boot.csrf};}
const post=(endpoint,body,session,extra={})=>fetch(base+endpoint,{method:'POST',headers:{cookie:session.cookie,'Content-Type':'application/json','Origin':base,'X-Studio-CSRF':session.csrf,...extra},body:JSON.stringify(body)});
test('protected durable generation workflow',async()=>{
 try{
  await start();let session=await auth();
  assert.equal((await fetch(base+'/api/jobs')).status,401);
  const provider=await(await fetch(base+'/api/provider',{headers:{cookie:session.cookie}})).json();assert.equal(provider.liveEnabled,false);assert.equal(provider.credentialVerified,false);assert.equal('credential' in provider,false);
  assert.equal((await post('/api/jobs',{},session,{Origin:'https://evil.example'})).status,403);
  assert.equal((await post('/api/assets',{filename:'fake.png',bytes:Buffer.from('not an image').toString('base64')},session)).status,400);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7T8AAAAASUVORK5CYII=';
  const upload=await post('/api/assets',{filename:'test.png',bytes:png},session);assert.equal(upload.status,201);const image=await upload.json();
  const draft={model:'simulation-i2v',prompt:'A slow push on @image1',duration:5,ratio:'9:16',references:[image.id]};
  assert.equal((await post('/api/draft',draft,session)).status,200);
  assert.equal((await post('/api/jobs',{...draft,prompt:'@image2',token:'invalid-reference-1234'},session)).status,400);
  const token='duplicate-test-token-12345';const [first,second]=await Promise.all([post('/api/jobs',{...draft,token},session),post('/api/jobs',{...draft,token},session)]);const a=await first.json();const b=await second.json();assert.equal(a.id,b.id);assert.equal(a.status,'pending');
  await new Promise(r=>setTimeout(r,1800));let jobs=await(await fetch(base+'/api/jobs',{headers:{cookie:session.cookie}})).json();assert.equal(jobs[0].status,'processing');
  await stop();await start();session=await auth();const bootstrap=await(await fetch(base+'/api/bootstrap',{headers:{cookie:session.cookie}})).json();assert.deepEqual(bootstrap.draft.references,[image.id]);
  await new Promise(r=>setTimeout(r,4000));jobs=await(await fetch(base+'/api/jobs',{headers:{cookie:session.cookie}})).json();assert.equal(jobs.length,1);assert.equal(jobs[0].status,'completed');assert.equal(jobs[0].id,a.id);
  const output=await fetch(base+jobs[0].output,{headers:{cookie:session.cookie,range:'bytes=0-127'}});assert.equal(output.status,206);assert.equal(output.headers.get('content-type'),'video/mp4');assert.equal((await output.arrayBuffer()).byteLength,128);
  const bad=await fetch(base+'/api/assets/..%2f..%2fpackage.json',{headers:{cookie:session.cookie}});assert.equal(bad.status,404);
  const failed=await(await post('/api/jobs',{...draft,simulateFailure:true,token:'failed-generation-12345'},session)).json();await new Promise(r=>setTimeout(r,5700));jobs=await(await fetch(base+'/api/jobs',{headers:{cookie:session.cookie}})).json();assert.equal(jobs.find(j=>j.id===failed.id).status,'failed');
 }finally{if(child?.exitCode===null)await stop();rmSync(data,{recursive:true,force:true});}
});
