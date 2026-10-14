import { z } from 'zod';
import { mkdirSync, createWriteStream, renameSync, statSync } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

export const KLING_ENDPOINT = 'kling-video/v3.0/std/image-to-video';
const requestSchema = z.object({ request_id: z.string().uuid(), status_url: z.string().url(), status: z.string() });
const statusSchema = z.object({ request_id: z.string().uuid(), status: z.enum(['queued','in_progress','completed','failed','nsfw','canceled']), video: z.object({ url: z.string().url() }).nullish() });
export function trustedMediaUrl(value, extraHosts = []) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const allowed = ['higgsfield.ai','higgs.ai','cloudfront.net','s3.amazonaws.com','r2.cloudflarestorage.com'];
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || ![...allowed,...extraHosts].some(domain => host === domain || host.endsWith('.' + domain)) && !/^[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(host)) throw new Error('Provider media host is not trusted. Verify its official storage host before adding it to STUDIO_MEDIA_HOSTS.');
  return url.href;
}
export function klingPayload(settings, imageUrl) {
  if (settings.references.length !== 1 || /@image\s*\d+/i.test(settings.prompt)) throw new Error('Kling 3.0 Standard accepts one start frame. Remove numbered image mentions and extra references before live submission.');
  if (![5,10].includes(settings.duration) || settings.ratio !== 'from-image') throw new Error('Unsupported live settings. Aspect ratio comes from the start image.');
  return { image_url: imageUrl, prompt: settings.prompt, duration: settings.duration, sound: 'off', cfg_scale: 0.5, multi_shots: false };
}
export function createHiggsfieldClient(config, transport = fetch) {
  const base = 'https://api.higgsfield.ai';
  const apiHeaders = { Authorization: 'Key ' + config.credential, 'Content-Type': 'application/json' };
  const extraHosts = config.mediaHosts || [];
  async function api(url, method = 'GET', payload, extra = {}) {
    const parsed = new URL(url);
    if (parsed.origin !== base || parsed.username || parsed.password) throw new Error('Untrusted provider API URL.');
    const response = await transport(parsed.href, { method, headers: { ...apiHeaders, ...extra }, body: payload === undefined ? undefined : JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      const messages = {401:'Higgsfield rejected the credentials.',402:'Higgsfield balance is insufficient.',403:'Higgsfield denied access.',404:'Provider model or request was not found.',429:'Higgsfield rate limit reached.'};
      const error = new Error(messages[response.status] || `Higgsfield returned HTTP ${response.status}.`); error.httpStatus = response.status; throw error;
    }
    return response.json();
  }
  return {
    async verify() {
      try { await api(base + '/requests/00000000-0000-4000-8000-000000000000/status'); return { accepted: true, httpStatus: 200 }; }
      catch (error) { if (error.httpStatus === 404) return { accepted: true, httpStatus:404 }; if (error.httpStatus === 401) return { accepted:false, httpStatus:401 }; throw new Error('The authentication check could not complete. No generation was sent.',{cause:error}); }
    },
    async upload(bytes, mime) {
      const result = z.object({ upload_url:z.string().url(), public_url:z.string().url(), upload_headers:z.record(z.string(),z.string()) }).parse(await api(base + '/files/generate-upload-url','POST',{content_type:mime}));
      const uploadUrl = trustedMediaUrl(result.upload_url, extraHosts);
      const publicUrl = trustedMediaUrl(result.public_url, extraHosts);
      if (Object.values(result.upload_headers).some(value => value.includes(config.credential))) throw new Error('Provider returned unsafe upload headers.');
      const upload = await transport(uploadUrl, {method:'PUT',headers:result.upload_headers,body:bytes,redirect:'error',signal:AbortSignal.timeout(60000)});
      if (!upload.ok) throw new Error('Provider reference upload failed. No generation was submitted.');
      return publicUrl;
    },
    async submit(settings, imageUrl, token) {
      const result = requestSchema.parse(await api(base + '/' + KLING_ENDPOINT,'POST',klingPayload(settings,imageUrl),{'Idempotency-Key':token}));
      if (new URL(result.status_url).origin !== base || !new URL(result.status_url).pathname.endsWith(`/${result.request_id}/status`)) throw new Error('Unexpected provider status URL. Submission may have been accepted.');
      return result;
    },
    async status(statusUrl, requestId) {
      const result = statusSchema.parse(await api(statusUrl));
      if (result.request_id !== requestId) throw new Error('Provider request ID did not match the saved job.');
      return result;
    },
    async download(url, directory, jobId) {
      if (!/^[a-f0-9-]{36}$/i.test(jobId)) throw new Error('Invalid local output identifier.');
      mkdirSync(directory,{recursive:true});
      let nextUrl = trustedMediaUrl(url, extraHosts); let response;
      for (let redirects = 0; redirects < 4; redirects++) {
        response = await transport(nextUrl,{redirect:'manual',signal:AbortSignal.timeout(120000)});
        if (response.status >= 300 && response.status < 400) { nextUrl = trustedMediaUrl(new URL(response.headers.get('location') || '',nextUrl).href,extraHosts); continue; }
        break;
      }
      if (!response?.ok || !response.body) throw new Error('Output download failed or expired. The existing provider job will be retried, not regenerated.');
      const file = path.join(directory,jobId + '.mp4'); let total = 0;
      const limit = new Transform({transform(chunk,_encoding,callback){total+=chunk.length;callback(total > 1024*1024*1024 ? new Error('Output exceeds the 1 GB download limit.') : null,chunk);}});
      await pipeline(Readable.fromWeb(response.body),limit,createWriteStream(file + '.tmp'));
      if (!statSync(file + '.tmp').size) throw new Error('Provider returned an empty output.');
      renameSync(file + '.tmp',file); return file;
    }
  };
}
