import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL, validateDraft, mentions, statusAt, imageType } from '../lib.mjs';
const draft = { model:MODEL.id, prompt:'Move around @image1 and @image 2', references:['a','b'], duration:5, ratio:'9:16' };
test('ordered mentions resolve to current reference positions',()=>{assert.deepEqual(mentions(draft.prompt),[1,2]);const reordered=validateDraft({...draft,references:['b','a']},()=>true);assert.equal(reordered.references[mentions(draft.prompt)[0]-1],'b');});
test('reject nonexistent mentions and unsupported provider inputs',()=>{assert.throws(()=>validateDraft({...draft,prompt:'@image3'},()=>true),/does not exist/);assert.throws(()=>validateDraft({...draft,model:'unapproved-live'},()=>true),/Live models/);assert.throws(()=>validateDraft({...draft,duration:99},()=>true),/Unsupported/);assert.throws(()=>validateDraft({...draft,references:['a','a']},()=>true),/duplicated/);assert.throws(()=>validateDraft(draft,()=>false),/missing/);});
test('simulated lifecycle survives restart using stored timestamps',()=>{const job={created:100,settings:{}};assert.equal(statusAt(job,100),'pending');assert.equal(statusAt(job,2000),'processing');assert.equal(statusAt(job,6000),'completed');assert.equal(statusAt({...job,settings:{simulateFailure:true}},6000),'failed');});
test('upload validation checks signatures instead of trusting file extension',()=>{assert.equal(imageType(Buffer.from([137,80,78,71,13,10,26,10,0]))[0],'image/png');assert.throws(()=>imageType(Buffer.from('<script>alert(1)</script>')),/valid PNG/);});
