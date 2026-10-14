import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const files=process.argv.slice(2);if(!files.length||files.length>8)throw new Error('Provide 1–8 image paths.');
const base=process.env.STUDIO_LOCAL_URL||'http://127.0.0.1:4310';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw new Error('Imports must target the local app.');
const root=await fetch(base);const cookie=root.headers.get('set-cookie').split(';')[0];
const boot=await(await fetch(base+'/api/bootstrap',{headers:{cookie}})).json();
async function post(endpoint,value){const response=await fetch(base+endpoint,{method:'POST',headers:{cookie,Origin:base,'Content-Type':'application/json','X-Studio-CSRF':boot.csrf},body:JSON.stringify(value)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
if(boot.draft){mkdirSync('data/draft-backups',{recursive:true});writeFileSync(`data/draft-backups/draft-${Date.now()}.json`,JSON.stringify(boot.draft,null,2));}
const references=[];
for(const file of files){const item=await post('/api/assets',{filename:path.basename(file),bytes:readFileSync(file).toString('base64')});references.push(item.id);}
await post('/api/draft',{model:'simulation-i2v',duration:5,ratio:'9:16',references,simulateFailure:false,confirmPaid:false,prompt:'Luxury BOSS ÉCLAT by VELSIUM perfume campaign. Use @image1 for the four-shot storyboard; @image2 for burgundy silk; @image3 for bottle design continuity; @image4 and @image5 for orange peel and floating golden droplets; @image6 for the burgundy bottle hero and @image7 for the gold-rimmed bottle reveal. Preserve the rectangular smoky-clear bottle, textured black cap, gold crown and border, ivory lettering, and burgundy/black palette. Slow deliberate camera movement, controlled gold rim lighting, realistic glass reflections. This multi-image draft is for simulation/planning; the current live model accepts only one start image.'});
console.log(`Imported ${references.length} local references and saved the simulation draft. No provider requests were sent.`);
