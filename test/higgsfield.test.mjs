import test from 'node:test';
import assert from 'node:assert/strict';
import { createHiggsfieldClient, klingPayload, trustedMediaUrl } from '../lib/higgsfield/adapter.mjs';
const settings={prompt:'A slow cinematic push-in',references:['start-frame'],duration:5,ratio:'from-image'};
test('Kling mapping rejects unsupported multi-image mentions and does not send ratio',()=>{
  const payload=klingPayload(settings,'https://fixture.cloudfront.net/ref.png');assert.equal(payload.sound,'off');assert.equal('aspect_ratio' in payload,false);
  assert.throws(()=>klingPayload({...settings,references:['a','b']},'url'),/one start frame/);
  assert.throws(()=>klingPayload({...settings,prompt:'Use @image1'},'url'),/numbered/);
  assert.throws(()=>klingPayload({...settings,ratio:'9:16'},'url'),/Aspect ratio/);
});
test('provider upload keeps credentials on the API and honors returned storage headers',async()=>{
  const calls=[];const secret='fake-test-credential';
  const transport=async(url,options)=>{calls.push({url,options});return calls.length===1?Response.json({upload_url:'https://fixture.s3.us-west-2.amazonaws.com/upload',public_url:'https://fixture.cloudfront.net/ref.png',upload_headers:{'Content-Type':'image/png','x-amz-tagging':'retention=temporary'}}):new Response(null,{status:200});};
  const client=createHiggsfieldClient({credential:secret},transport);
  assert.equal(await client.upload(Buffer.from('test bytes'),'image/png'),'https://fixture.cloudfront.net/ref.png');
  assert.equal(calls[0].options.headers.Authorization,'Key '+secret);assert.equal(calls[1].options.headers.Authorization,undefined);assert.equal(calls[1].options.headers['x-amz-tagging'],'retention=temporary');
});
test('provider submission uses a stable idempotency key and verifies returned request identity',async()=>{
  const id='00000000-0000-4000-8000-000000000001';const statusUrl=`https://api.higgsfield.ai/requests/${id}/status`;const calls=[];
  const client=createHiggsfieldClient({credential:'fake'},async(url,options)=>{calls.push({url,options});return Response.json({request_id:id,status_url:statusUrl,status:'queued',video:null});});
  const result=await client.submit(settings,'https://fixture.cloudfront.net/ref.png','stable-token');assert.equal(result.request_id,id);assert.equal(calls[0].options.headers['Idempotency-Key'],'stable-token');await client.status(statusUrl,id);assert.equal(calls.length,2);
  await assert.rejects(()=>client.status(statusUrl,'different-request'),/did not match/);
});
test('media URL and authentication safeguards',async()=>{
  assert.throws(()=>trustedMediaUrl('http://127.0.0.1/private'),/not trusted/);assert.throws(()=>trustedMediaUrl('https://evil.example/file'),/not trusted/);assert.throws(()=>trustedMediaUrl('https://user:pass@fixture.cloudfront.net/file'),/not trusted/);
  const client=createHiggsfieldClient({credential:'fake'},async()=>Response.json({detail:'Invalid credentials'},{status:401}));
  assert.deepEqual(await client.verify(),{accepted:false,httpStatus:401});await assert.rejects(()=>client.status('https://evil.example/status','id'),/Untrusted/);
});
