// Focused browser check against an isolated server with live execution disabled.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});await page.goto(process.env.STUDIO_TEST_URL||'http://127.0.0.1:4312');
  await page.waitForFunction(()=>document.querySelector('#draft-status').textContent==='Draft saved locally');
  await page.locator('#model').selectOption('kling-video/v3.0/std/image-to-video');
  assert.equal(await page.locator('#generate').isDisabled(),true);assert.match(await page.locator('#generate').innerText(),/Generate video/);
  assert.equal(await page.locator('#ratio').isDisabled(),true);assert.equal(await page.locator('#confirm-paid').isChecked(),false);
  assert.equal(await page.locator('#preview-badge').innerText(),'Reference preview');
  await page.screenshot({path:path.resolve('test-results/live-approval-gate.png'),fullPage:true});
  console.log('Live approval gate passed; no generation submitted.');
}finally{await browser.close();}
