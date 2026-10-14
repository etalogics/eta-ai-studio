// Reports only paths/counts, never matched secret content.
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const env=existsSync('.env')?readFileSync('.env','utf8'):'';
const credential=env.match(/^HF_API_KEY=(.+)$/m)?.[1]?.trim();
const secrets=credential?[credential,credential.split(':').at(-1),encodeURIComponent(credential)]:[];
const objects=git('rev-list','--objects','--all').split('\n');const findings=[];
for(const line of objects){const [id,...name]=line.split(' ');if(!id)continue;if(git('cat-file','-t',id)!=='blob')continue;const bytes=execFileSync('git',['cat-file','blob',id],{maxBuffer:32*1024*1024});if(secrets.some(secret=>secret&&bytes.includes(Buffer.from(secret))))findings.push({path:name.join(' '),reason:'Local credential found in Git history'});const text=bytes.toString('utf8');if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({path:name.join(' '),reason:'Private-key marker found'});}
const tracked=git('ls-files').split('\n');
for(const file of tracked)if(/(^|\/)(node_modules|data|\.next|delivery)(\/|$)|\.sqlite(?:-|$)|(^|\/)\.env(?:$|\.(?!example$))/.test(file))findings.push({path:file,reason:'Forbidden runtime or credential file tracked'});
const identities=git('log','--all','--format=%an <%ae> | %cn <%ce>');const trailers=git('log','--all','--format=%b');
if(/codex|cursor/i.test(identities)||/Co-authored-by:.*(?:codex|cursor)/i.test(trailers))findings.push({reason:'Unwanted contributor attribution'});
console.log(JSON.stringify({historyObjectsChecked:objects.length,trackedFiles:tracked.length,findings},null,2));
if(findings.length)process.exitCode=1;
