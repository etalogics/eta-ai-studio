const $ = s => document.querySelector(s);
let csrf, references = [], jobs = [], currentJob = null, dragId = null, saving = null, loadingDraft = true, busy = false, models = [], providerStatus = null, pendingSubmission = null;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url, data) {
  const response = await fetch(url, data === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json','X-Studio-CSRF':csrf}, body:JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) {const error=new Error(result.error || 'Request failed.');error.httpStatus=response.status;throw error;} return result;
}
function toast(text) { $('#toast').textContent=text; $('#toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').hidden=true,5000); }
function showError(text) { $('#form-error').textContent=text; $('#form-error').hidden=!text; }
function settings() { return { prompt:$('#prompt').value, model:$('#model').value, duration:Number($('#duration').value), ratio:$('#ratio').value, references:references.map(r=>r.id), simulateFailure:$('#simulate-failure').checked,confirmPaid:$('#confirm-paid').checked }; }
function updateGenerate(){const live=$('#model').value!=='simulation-i2v';$('#generate').disabled=loadingDraft||busy||(live&&(!providerStatus?.liveEnabled||jobs.some(job=>job.mode==='live'&&['pending','processing','unknown'].includes(job.status))));}
function configureModel(reset = true){
  const descriptor=models.find(model=>model.id===$('#model').value)||models[0];if(!descriptor)return;
  const live=descriptor.id!=='simulation-i2v';const oldRatio=$('#ratio').value;
  $('#ratio').innerHTML=descriptor.ratios.map(value=>`<option value="${value}">${value==='from-image'?'From start image':value+' · '+(value==='9:16'?'Vertical':value==='16:9'?'Landscape':'Square')}</option>`).join('');
  $('#ratio').disabled=live;$('#ratio').value=descriptor.ratios.includes(oldRatio)?oldRatio:descriptor.ratios[0];
  $('#paid-choice').hidden=!live;$('.demo-options').hidden=live;$('#model-mode').textContent=live?'LIVE · PAID':'SIMULATION';
  $('#generate').innerHTML=`<span>✧</span> ${live?'Generate video':'Generate preview'} <span>↗</span>`;
  $('#model-help').textContent=live?'One start frame, no audio. Ratio comes from that image. Extra references and @image tokens are blocked. '+(providerStatus?.liveEnabled?'Explicit paid approval is required for every job.':'Live generation is disabled pending approval.'):'Simulation uses bundled sample clips and sends no API requests.';
  $('.generate-row strong').innerHTML=live?'Unavailable <small>Estimate optional · provider billing applies</small>':'$0.00 <small>Simulation · no API calls</small>';
  $('.mode-pill').innerHTML=`<i></i> ${live?'Live model · paid':'Simulation mode'}`;
  $('.simulation-banner>div').innerHTML=live?'<strong>Live provider mode.</strong> Your start image and prompt will be sent to Higgsfield only after an approved Generate action. Charges apply.':'<strong>A workspace ready for your ideas.</strong> Simulation is active. Jobs use a sample clip; your prompt and images are not sent to an AI provider. No charges.';
  if(reset){currentJob=null;renderPreview();$('#confirm-paid').checked=false;$('#simulate-failure').checked=false;toast('Model settings updated. Review supported references and aspect ratio.');saveDraft();}
  updateGenerate();
}
function saveDraft() {
  $('#prompt-count').textContent=$('#prompt').value.length;
  if (loadingDraft) return;
  clearTimeout(saving); $('#draft-status').textContent='Saving draft…';
  saving=setTimeout(async()=>{ try { await api('/api/draft',settings()); $('#draft-status').textContent='Draft saved locally'; } catch(error) { $('#draft-status').textContent='Draft not saved'; toast(error.message); } },350);
}
function warnOrder() { if (/@image\s*\d+/i.test($('#prompt').value)) { $('#order-notice').hidden=false; toast('Image numbering changed. Review the numbered mentions in your prompt.'); } }
function move(from,to) { if (to<0 || to>=references.length || from===to) return; const [item]=references.splice(from,1); references.splice(to,0,item); warnOrder(); renderReferences(); saveDraft(); }
function renderReferences() {
  $('#reference-count').textContent=`${references.length} / 8`;
  $('#reference-gallery').innerHTML=references.map((r,i)=>`<article class="reference-card" draggable="true" data-id="${r.id}"><img src="${r.url}" alt="Reference image ${i+1}"><span class="image-label">Image ${i+1}</span><button class="remove" type="button" data-remove="${i}" aria-label="Remove image ${i+1}">×</button><p title="${escape(r.filename)}">${escape(r.filename)}</p><small>${i===0?'Start frame':'Reference · simulation'}</small><div class="reorder-controls"><button type="button" data-move="${i},-1" aria-label="Move image ${i+1} left" ${i===0?'disabled':''}>←</button><span aria-label="Drag to reorder">⠿</span><button type="button" data-move="${i},1" aria-label="Move image ${i+1} right" ${i===references.length-1?'disabled':''}>→</button></div></article>`).join('');
  $('#reference-chips').innerHTML=references.length?references.map((r,i)=>`<button type="button" data-insert="${i+1}" title="${escape(r.filename)}">@image${i+1}</button>`).join(''):'<span>Add images to insert references</span>';
  if (!currentJob) renderPreview();
}
async function upload(files) {
  if (loadingDraft) return toast('Wait for the saved workspace to finish loading.');
  if (busy) return toast('Wait for the current upload to finish.');
  if (files.length+references.length>8) return showError('You can retain up to 8 images. Remove an image before adding more.');
  busy=true; $('#generate').disabled=true; showError(''); $('#draft-status').textContent='Uploading references…';
  try {
    for (const file of files) {
      if (file.size>10*1024*1024) throw new Error(`${file.name} exceeds 10 MB.`);
      const bytes=await new Promise((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>resolve(reader.result.split(',')[1]); reader.onerror=()=>reject(new Error('Could not read image.')); reader.readAsDataURL(file);});
      const item=await api('/api/assets',{filename:file.name,bytes}); references.push(item); renderReferences();
    }
  } catch(error) { showError(error.message); } finally { busy=false; updateGenerate(); $('#upload').value=''; saveDraft(); }
}
function showPage(page) {
  for (const name of ['create','history','settings']) $(`#${name}-page`).hidden=name!==page;
  document.querySelectorAll('[data-page]').forEach(button=>button.classList.toggle('active',button.dataset.page===page));
  $('#page-title').textContent=page[0].toUpperCase()+page.slice(1);
  if (page==='history') loadJobs();
}
function renderPreview() {
  const content=$('#preview-content'); $('#output-actions').hidden=true;
  document.querySelector('.output-label')?.remove();
  if (!currentJob) {
    $('#preview-badge').className='status-badge'; $('#preview-badge').textContent=references.length?'Reference preview':'Ready when you are';
    content.innerHTML=references.length?`<img class="reference-preview" src="${references[0].url}" alt="Current start frame reference">`:'<div class="empty-preview"><div class="preview-art"><span>✧</span></div><h3>Your next story starts here.</h3><p>Add a reference and a prompt.<br>Your preview will appear in this space.</p></div>'; return;
  }
  const job=currentJob; $('#preview-badge').className=`status-badge ${job.status}`; $('#preview-badge').textContent=job.status[0].toUpperCase()+job.status.slice(1);
  if (job.status==='completed') {
    content.innerHTML=`<video controls playsinline preload="metadata" src="${job.output}"></video>`;
    $('#output-actions').hidden=false; $('#download').href=job.output+'?download=1';$('#download').textContent=job.mode==='live'?'↓ Download video':'↓ Download sample';
    const label=document.createElement('div'); label.className='output-label'; label.textContent=job.mode==='live'?'LIVE OUTPUT · Downloaded from Higgsfield and saved on this computer.':`SIMULATED OUTPUT · A bundled ${job.settings.duration}-second sample clip, not AI-generated from your references or prompt.`; $('#output-actions').after(label);
  } else if (job.status==='failed') content.innerHTML=`<div class="job-info"><span class="banner-icon">⚠</span><h3>Generation failed</h3><p>${escape(job.error)}</p><button class="secondary" id="retry-settings">Review settings</button></div>`;
  else if(job.status==='unknown')content.innerHTML='<div class="job-info"><h3>Submission status unknown</h3><p>The provider may have accepted the paid request. Check the Higgsfield console before creating another job. This request will not be automatically resubmitted.</p></div>';
  else content.innerHTML=`<div class="job-info"><span class="spinner"></span><h3>${job.status==='pending'?'Your idea is in the queue.':job.mode==='live'?'Generation is processing.':'Simulating your generation.'}</h3><p>${job.mode==='live'?'The local worker is tracking the saved Higgsfield request.':job.status==='pending'?'Preparing the local demonstration…':'The sample output will be ready shortly.'}<br>${job.mode==='live'?escape(job.error||'Provider billing applies. No duplicate generation is submitted by polling.'):'No provider requests. No charges.'}</p></div>`;
}
async function restore(draft) {
  loadingDraft=true;
  try { references=await Promise.all(draft.references.map(id=>api(`/api/assets/${id}?metadata=1`))); $('#prompt').value=draft.prompt||''; $('#model').value=models.some(m=>m.id===draft.model)?draft.model:'simulation-i2v';configureModel(false); $('#duration').value=draft.duration||5; $('#ratio').value=draft.ratio||'9:16'; $('#simulate-failure').checked=Boolean(draft.simulateFailure);$('#confirm-paid').checked=false; $('#prompt-count').textContent=$('#prompt').value.length; $('#order-notice').hidden=true; renderReferences(); }
  finally { loadingDraft=false;updateGenerate(); }
}
function renderHistory() {
  const filter=$('#history-filter').value; const visible=jobs.filter(job=>filter==='all'||job.status===filter); $('#history-count').textContent=jobs.length;
  $('#history-list').innerHTML=visible.length?visible.map(job=>`<article class="history-card"><img src="/api/assets/${job.settings.references[0]}" alt="Saved start frame"><div class="history-detail"><div class="history-top"><span class="history-meta">${escape(new Date(job.created).toLocaleString())}</span><span class="status-badge ${job.status}">${job.status} · ${job.mode}</span></div><p>${escape(job.settings.prompt)}</p><div class="history-meta">${escape(job.settings.model)} · ${job.settings.duration}s · ${escape(job.settings.ratio)} · ${job.settings.references.length} references · ${job.mode==='live'?'Actual charge unavailable':'$0.00'}</div><div class="history-actions"><button class="secondary" data-view-job="${job.id}">View result</button><button class="secondary" data-restore-job="${job.id}">Use settings</button>${job.output?`<a class="secondary" href="${job.output}?download=1" download>↓ ${job.mode==='live'?'Video':'Sample clip'}</a>`:''}</div>${job.error?`<p class="notice">${escape(job.error)}</p>`:''}</div></article>`).join(''):'<div class="settings-card"><h2>No generations yet.</h2><p>Your saved generations will appear here. Start with a reference and a prompt in Create.</p><button class="secondary" data-go-create>Create your first preview ↗</button></div>';
}
async function loadJobs() {
  try { jobs=await api('/api/jobs'); $('#history-count').textContent=jobs.length; renderHistory(); if (currentJob) { const next=jobs.find(j=>j.id===currentJob.id); if (next&&(next.status!==currentJob.status||next.error!==currentJob.error)) { currentJob=next; renderPreview(); } }updateGenerate(); }
    catch(error) { toast(error.message); }
}
$('#upload').addEventListener('change',event=>upload([...event.target.files]));
$('#dropzone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#upload').click();}});
for (const type of ['dragenter','dragover']) $('#dropzone').addEventListener(type,e=>{e.preventDefault();$('#dropzone').classList.add('dragover');});
for (const type of ['dragleave','drop']) $('#dropzone').addEventListener(type,e=>{e.preventDefault();$('#dropzone').classList.remove('dragover');if(type==='drop')upload([...e.dataTransfer.files]);});
$('#reference-gallery').addEventListener('dragstart',e=>{const card=e.target.closest('[data-id]');if(!card)return;dragId=card.dataset.id;e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';card.classList.add('dragging');});
$('#reference-gallery').addEventListener('dragover',e=>{e.preventDefault();document.querySelectorAll('.drag-target').forEach(c=>c.classList.remove('drag-target'));e.target.closest('[data-id]')?.classList.add('drag-target');});
$('#reference-gallery').addEventListener('drop',e=>{e.preventDefault();const card=e.target.closest('[data-id]');if(card&&dragId)move(references.findIndex(r=>r.id===dragId),references.findIndex(r=>r.id===card.dataset.id));});
$('#reference-gallery').addEventListener('dragend',()=>{dragId=null;document.querySelectorAll('.dragging,.drag-target').forEach(c=>c.classList.remove('dragging','drag-target'));});
document.addEventListener('click',async e=>{
  const button=e.target.closest('button'); if (!button) return;
  if (button.dataset.page) showPage(button.dataset.page);
  if (button.dataset.remove!==undefined) { references.splice(Number(button.dataset.remove),1);warnOrder();renderReferences();saveDraft(); }
  if (button.dataset.move) { const [index,offset]=button.dataset.move.split(',').map(Number);move(index,index+offset); }
  if (button.dataset.insert) { const field=$('#prompt');const start=field.selectionStart;field.setRangeText(`@image${button.dataset.insert}`,start,field.selectionEnd,'end');field.focus();saveDraft(); }
  if (button.dataset.viewJob) { currentJob=jobs.find(j=>j.id===button.dataset.viewJob);showPage('create');renderPreview();window.scrollTo({top:0,behavior:'smooth'}); }
  if (button.dataset.restoreJob) { const job=jobs.find(j=>j.id===button.dataset.restoreJob);currentJob=null;await restore(job.settings);saveDraft();showPage('create');toast('Settings restored. Click Generate to start a new simulation.'); }
  if (button.hasAttribute('data-go-create')) showPage('create');
  if (button.id==='integration-link') showPage('settings');
  if (button.id==='refresh-history') loadJobs();
  if (button.id==='copy-prompt'&&currentJob) { try{await navigator.clipboard.writeText(currentJob.settings.prompt);toast('Prompt copied.');}catch{toast('Clipboard access unavailable. Copy the prompt from history.');} }
  if (['use-settings','retry-settings'].includes(button.id)&&currentJob) { const draft=currentJob.settings;currentJob=null;await restore(draft);saveDraft();toast('Settings restored. Review and click Generate when ready.'); }
});
for(const id of ['prompt','model','duration','ratio','simulate-failure']) $(`#${id}`).addEventListener('input',saveDraft);
$('#model').addEventListener('change',()=>configureModel());
$('#history-filter').addEventListener('change',renderHistory);
$('#create-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;showError('');const draft=settings();
  if(!draft.references.length)return showError('Upload at least one reference image.');
  if(!draft.prompt.trim())return showError('Write a prompt before generating.');
  const invalid=[...draft.prompt.matchAll(/@image\s*(\d+)\b/gi)].map(m=>Number(m[1])).find(n=>n<1||n>references.length);
  if(invalid!==undefined)return showError(`@image${invalid} does not exist. Update the prompt or upload another reference.`);
  const live=draft.model!=='simulation-i2v';
  if(live && (draft.references.length!==1 || /@image\s*\d+/i.test(draft.prompt)))return showError('This live model supports one start frame and no numbered image mentions. Remove extra references and @image tokens.');
  if(live&&!providerStatus?.liveEnabled)return showError('Live generation is disabled pending approval.');
  if(live&&!draft.confirmPaid)return showError('Approve this paid generation using the checkbox before submitting.');
  if(pendingSubmission&&JSON.stringify(pendingSubmission.draft)!==JSON.stringify(draft))return showError('A previous submission reply was lost. Check History before changing settings and starting another job.');
  if(!pendingSubmission)pendingSubmission={draft,token:crypto.randomUUID()};
  busy=true;$('#generate').disabled=true;
  try{currentJob=await api('/api/jobs',{...draft,token:pendingSubmission.token});pendingSubmission=null;$('#confirm-paid').checked=false;renderPreview();await loadJobs();toast(live?'Approved live job queued. Provider billing applies.':'Simulation started. No paid request was sent.');}catch(error){if(error.httpStatus)pendingSubmission=null;showError(error.httpStatus?error.message:'Submission reply unavailable. Check History. Retry uses the same token to prevent duplicate generation.');}finally{busy=false;updateGenerate();}
});
(async()=>{try{const bootstrap=await api('/api/bootstrap');csrf=bootstrap.csrf;
  const provider=await api('/api/provider');providerStatus=provider;models=bootstrap.models||[bootstrap.model];$('#model').innerHTML=models.map(model=>`<option value="${escape(model.id)}">${escape(model.name)}</option>`).join('');configureModel(false);
  const card=document.createElement('div');card.className='settings-card';
  card.innerHTML=`<h2>Server-side API configuration</h2><p>Provider: ${escape(provider.provider)}<br>Credentials: ${provider.credentialVerified?'Authentication accepted · server only':provider.credentialsConfigured?'Configured on server · unverified':'Not configured'}<br>Approved model: ${provider.modelConfigured?'Configured · account model access untested':'Not configured'}<br>Live generation: ${provider.liveEnabled?'Enabled · explicit paid approval per job':'disabled'}</p><p>Set credentials in the local .env file and restart. Keys are never returned to this page.</p><ul>${provider.blockers.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`;
  $('#settings-page').append(card);
  if(bootstrap.draft)await restore(bootstrap.draft);loadingDraft=false;await loadJobs();updateGenerate();$('#draft-status').textContent='Draft saved locally';if(jobs.length&&['pending','processing','unknown'].includes(jobs[0].status)){currentJob=jobs[0];renderPreview();}setInterval(()=>{if(jobs.some(j=>['pending','processing'].includes(j.status)))loadJobs();},1000);}catch(error){showError(error.message);$('#generate').disabled=true;}})();
