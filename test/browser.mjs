// Optional browser QA: set PLAYWRIGHT_MODULE to an installed playwright index.mjs.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const out=path.resolve('test-results');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1080},recordVideo:{dir:out,size:{width:1440,height:1080}}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.STUDIO_TEST_URL || 'http://127.0.0.1:4310');await page.waitForFunction(()=>document.querySelector('#generate').disabled===false);
// Restore an empty workspace through the UI when re-running this QA script.
while(await page.locator('.reference-card').count()) await page.locator('[data-remove]').first().click();
if(await page.locator('#simulate-failure').isChecked()){await page.locator('.demo-options summary').click();await page.locator('#simulate-failure').uncheck();await page.locator('.demo-options summary').click();}
await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
const images=await page.evaluate(()=>Array.from({length:5},(_,i)=>{const c=document.createElement('canvas');c.width=480;c.height=640;const ctx=c.getContext('2d');ctx.fillStyle=['#69639b','#578d8c','#9b7763','#718659','#9a6080'][i];ctx.fillRect(0,0,480,640);ctx.fillStyle='#ffffff';ctx.font='32px sans-serif';ctx.fillText('Synthetic reference '+(i+1),55,310);return c.toDataURL('image/png').split(',')[1];}));
await page.locator('#upload').setInputFiles(images.map((b,i)=>({name:`demo-reference-${i+1}.png`,mimeType:'image/png',buffer:Buffer.from(b,'base64')})));
await page.waitForFunction(()=>document.querySelectorAll('.reference-card').length===5);
await page.locator('#prompt').fill('Use @image1 as the opening frame. Match the color palette of @image2. A slow cinematic push-in with soft natural light.');
// Drag the fifth image into first position; mentions retain numbered-position semantics.
await page.locator('.reference-card').nth(4).dragTo(page.locator('.reference-card').nth(0));
assert.match(await page.locator('.reference-card').first().innerText(),/demo-reference-5/);
await page.getByRole('button',{name:'Move image 1 right',exact:true}).click();
await page.getByRole('button',{name:'Remove image 2',exact:true}).click();
assert.equal(await page.locator('.reference-card').count(),4);
await page.locator('#upload').setInputFiles([{name:'appended-reference.png',mimeType:'image/png',buffer:Buffer.from(images[0],'base64')}]);
await page.waitForFunction(()=>document.querySelectorAll('.reference-card').length===5);
assert.match(await page.locator('.reference-card').last().innerText(),/appended-reference/);
await page.getByRole('button',{name:'Remove image 5',exact:true}).click();
await page.locator('#prompt').fill('Invalid reference @image9');await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#form-error').hidden);assert.match(await page.locator('#form-error').innerText(),/does not exist/);
await page.locator('#prompt').fill('A slow cinematic push-in on @image1. Match the palette in @image2. Natural light and deliberate movement.');
await page.locator('#prompt').click();await page.getByRole('button',{name:'@image3',exact:true}).click();assert.match(await page.locator('#prompt').inputValue(),/@image3/);
await page.waitForFunction(()=>document.querySelector('#draft-status').textContent==='Draft saved locally');
await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.reference-card').length===4);
await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#preview-badge').textContent==='Pending');
await page.waitForFunction(()=>document.querySelector('#preview-badge').textContent==='Processing');
await page.waitForFunction(()=>document.querySelector('#preview-badge').textContent==='Completed');
await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
assert.equal(await page.locator('video').evaluate(v=>Math.round(v.duration)),5);
await page.locator('video').evaluate(async v=>{await v.play();await new Promise(resolve=>v.requestVideoFrameCallback(resolve));});
await page.screenshot({path:path.join(out,'completed.png'),fullPage:true});
await page.locator('[data-page="history"]').click();await page.waitForSelector('.history-card');await page.screenshot({path:path.join(out,'history.png'),fullPage:true});
await page.locator('[data-restore-job]').first().click();await page.locator('.demo-options summary').click();await page.locator('#simulate-failure').check();await page.locator('#generate').click();await page.waitForFunction(()=>document.querySelector('#preview-badge').textContent==='Failed');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
assert.deepEqual(errors,[]);
console.log('Browser QA passed: five uploads, drag reorder, keyboard reorder, removal, reference insertion, invalid mention, draft reload, pending/processing/completed/failed, playable output, history, and mobile overflow.');
const video=page.video();await context.close();console.log('Demo recording: '+await video.path());await browser.close();
