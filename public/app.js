const $ = s => document.querySelector(s);
let csrf, references = [], jobs = [], currentJob = null, dragId = null, saving = null, loadingDraft = true, busy = false;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url, data) {
  const response = await fetch(url, data === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json','X-Studio-CSRF':csrf}, body:JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Request failed.'); return result;
}
function toast(text) { $('#toast').textContent=text; $('#toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').hidden=true,5000); }
function showError(text) { $('#form-error').textContent=text; $('#form-error').hidden=!text; }
function settings() { return { prompt:$('#prompt').value, model:$('#model').value, duration:Number($('#duration').value), ratio:$('#ratio').value, references:references.map(r=>r.id), simulateFailure:$('#simulate-failure').checked }; }
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
  if (busy) return toast('Wait for the current upload to finish.');
  if (files.length+references.length>8) return showError('You can retain up to 8 images. Remove an image before adding more.');
  busy=true; $('#generate').disabled=true; showError(''); $('#draft-status').textContent='Uploading references…';
  try {
    for (const file of files) {
      if (file.size>10*1024*1024) throw new Error(`${file.name} exceeds 10 MB.`);
      const bytes=await new Promise((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>resolve(reader.result.split(',')[1]); reader.onerror=()=>reject(new Error('Could not read image.')); reader.readAsDataURL(file);});
      const item=await api('/api/assets',{filename:file.name,bytes}); references.push(item); renderReferences();
    }
  } catch(error) { showError(error.message); } finally { busy=false; $('#generate').disabled=false; $('#upload').value=''; saveDraft(); }
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
    $('#output-actions').hidden=false; $('#download').href=job.output+'?download=1';
    const label=document.createElement('div'); label.className='output-label'; label.textContent='SIMULATED OUTPUT · A bundled 5-second sample clip, not AI-generated from your references or prompt.'; $('#output-actions').after(label);
  } else if (job.status==='failed') content.innerHTML=`<div class="job-info"><span class="banner-icon">⚠</span><h3>Generation failed</h3><p>${escape(job.error)}</p><button class="secondary" id="retry-settings">Review settings</button></div>`;
  else content.innerHTML=`<div class="job-info"><span class="spinner"></span><h3>${job.status==='pending'?'Your idea is in the queue.':'Simulating your generation.'}</h3><p>${job.status==='pending'?'Preparing the local demonstration…':'The sample output will be ready shortly.'}<br>No provider requests. No charges.</p></div>`;
}
async function restore(draft) {
  loadingDraft=true;
  try { references=await Promise.all(draft.references.map(id=>api(`/api/assets/${id}?metadata=1`))); $('#prompt').value=draft.prompt||''; $('#model').value='simulation-i2v'; $('#duration').value=draft.duration||5; $('#ratio').value=draft.ratio||'9:16'; $('#simulate-failure').checked=Boolean(draft.simulateFailure); $('#prompt-count').textContent=$('#prompt').value.length; $('#order-notice').hidden=true; renderReferences(); }
  finally { loadingDraft=false; }
}
function renderHistory() {
  const filter=$('#history-filter').value; const visible=jobs.filter(job=>filter==='all'||job.status===filter); $('#history-count').textContent=jobs.length;
  $('#history-list').innerHTML=visible.length?visible.map(job=>`<article class="history-card"><img src="/api/assets/${job.settings.references[0]}" alt="Saved start frame"><div class="history-detail"><div class="history-top"><span class="history-meta">${escape(new Date(job.created).toLocaleString())}</span><span class="status-badge ${job.status}">${job.status} · simulation</span></div><p>${escape(job.settings.prompt)}</p><div class="history-meta">Image-to-video · ${job.settings.duration}s · ${escape(job.settings.ratio)} · ${job.settings.references.length} references · $0.00</div><div class="history-actions"><button class="secondary" data-view-job="${job.id}">View result</button><button class="secondary" data-restore-job="${job.id}">Use settings</button>${job.output?`<a class="secondary" href="${job.output}?download=1" download>↓ Sample clip</a>`:''}</div>${job.error?`<p class="notice">${escape(job.error)}</p>`:''}</div></article>`).join(''):'<div class="settings-card"><h2>No generations yet.</h2><p>Your saved generations will appear here. Start with a reference and a prompt in Create.</p><button class="secondary" data-go-create>Create your first preview ↗</button></div>';
}
async function loadJobs() {
  try { jobs=await api('/api/jobs'); $('#history-count').textContent=jobs.length; renderHistory(); if (currentJob) { const next=jobs.find(j=>j.id===currentJob.id); if (next&&next.status!==currentJob.status) { currentJob=next; renderPreview(); } } }
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
$('#history-filter').addEventListener('change',renderHistory);
$('#create-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;showError('');const draft=settings();
  if(!draft.references.length)return showError('Upload at least one reference image.');
  if(!draft.prompt.trim())return showError('Write a prompt before generating.');
  const invalid=[...draft.prompt.matchAll(/@image\s*(\d+)\b/gi)].map(m=>Number(m[1])).find(n=>n<1||n>references.length);
  if(invalid!==undefined)return showError(`@image${invalid} does not exist. Update the prompt or upload another reference.`);
  busy=true;$('#generate').disabled=true;
  try{currentJob=await api('/api/jobs',{...draft,token:crypto.randomUUID()});renderPreview();await loadJobs();toast('Simulation started. No paid request was sent.');}catch(error){showError(error.message);}finally{busy=false;$('#generate').disabled=false;}
});
(async()=>{try{const bootstrap=await api('/api/bootstrap');csrf=bootstrap.csrf;if(bootstrap.draft)await restore(bootstrap.draft);loadingDraft=false;await loadJobs();if(jobs.length&&['pending','processing'].includes(jobs[0].status)){currentJob=jobs[0];renderPreview();}setInterval(()=>{if(jobs.some(j=>['pending','processing'].includes(j.status)))loadJobs();},1000);}catch(error){showError(error.message);$('#generate').disabled=true;}})();
